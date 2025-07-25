import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { EvolutionAPIService, type EvolutionAPIResponse } from '@/services/evolution-api-complete';
import { logger } from '@/utils/logger';

interface GlobalConfig {
  server_url: string;
  api_key: string;
  ativo: boolean;
}

interface InstanceConfig {
  id: string;
  instance_name: string;
  webhook_url: string;
  webhook_events: string[];
  ativo: boolean;
  status: string;
  qr_code?: string;
  numero?: string;
  descricao?: string;
}

/**
 * Hook principal para Evolution API v2 - Gerenciamento Completo
 * 
 * CENTRALIZA todas as operações da Evolution API em um hook único:
 * - Configuração global e testes de conectividade  
 * - Gerenciamento completo de instâncias (criar, conectar, deletar)
 * - Envio de mensagens (texto, mídia, botões, listas, etc.)
 * - Operações de chat e contatos
 * - Configuração avançada de webhooks
 * - Gerenciamento de grupos e perfis
 * 
 * Fornece tratamento de erro robusto e feedback via toast
 */
export function useEvolutionAPIComplete() {
  const [config, setConfig] = useState<GlobalConfig | null>(null);
  const [instanceConfig, setInstanceConfig] = useState<InstanceConfig | null>(null);
  const [service, setService] = useState<EvolutionAPIService | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Carrega configuração global da Evolution API
  const loadGlobalConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: configError } = await supabase
        .from('evolution_api_global_config')
        .select('server_url, api_key, ativo')
        .eq('ativo', true)
        .maybeSingle();

      if (configError) {
        throw configError;
      }

      if (!data) {
        throw new Error('Configuração global da Evolution API não encontrada. Configure a Evolution API no painel de administração.');
      }

      const newService = new EvolutionAPIService(data.server_url, data.api_key);
      
      // Testar conectividade antes de definir como ativo
      const connectionTest = await newService.testConnection();
      if (!connectionTest.success) {
        throw new Error(`Erro de conectividade: ${connectionTest.error}`);
      }

      setConfig(data);
      setService(newService);

      // Carregar configuração da instância ativa
      const { data: instanceData } = await supabase
        .from('evolution_api_config')
        .select('*')
        .eq('ativo', true)
        .maybeSingle();

      if (instanceData) {
        setInstanceConfig(instanceData);
      }

      logger.info('Configuração Evolution API carregada e testada', {
        component: 'useEvolutionAPIComplete'
      });
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(errorMessage);
      logger.error('Erro ao carregar configuração Evolution API', {
        component: 'useEvolutionAPIComplete'
      }, err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Verifica se o serviço está disponível
  const isServiceAvailable = useCallback(() => {
    return service !== null && config !== null;
  }, [service, config]);

  // Wrapper para executar operações com tratamento de erro
  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<EvolutionAPIResponse<T>>,
    operationName: string,
    showLoadingToast = true
  ): Promise<T | null> => {
    if (!isServiceAvailable()) {
      // Só mostrar erro se não estiver carregando
      if (!loading && showLoadingToast) {
        toast({
          title: "Serviço indisponível",
          description: "Configuração da Evolution API não foi carregada",
          variant: "destructive",
        });
      }
      return null;
    }

    try {
      const result = await operation();
      
      if (result.error) {
        throw new Error(result.error);
      }

      logger.info(`${operationName} executado com sucesso`, {
        component: 'useEvolutionAPIComplete'
      });

      return result.data || null;
    } catch (err) {
      const errorMessage = (err as Error).message;
      logger.error(`Erro em ${operationName}`, {
        component: 'useEvolutionAPIComplete'
      }, err as Error);
      
      toast({
        title: "Erro na operação",
        description: `${operationName}: ${errorMessage}`,
        variant: "destructive",
      });
      
      return null;
    }
  }, [isServiceAvailable, loading, toast]);

  // Teste de conectividade da API
  const testApiConnection = useCallback(async () => {
    if (!service) {
      return { success: false, error: 'Serviço não inicializado' };
    }
    
    return await service.testConnection();
  }, [service]);

  // ===== OPERAÇÕES DE INSTÂNCIA =====
  const createInstance = useCallback(async (instanceData: {
    instanceName: string;
    number?: string;
    webhook?: string;
    events?: string[];
  }) => {
    // Verificar conectividade antes de criar instância
    const connectionTest = await testApiConnection();
    if (!connectionTest.success) {
      toast({
        title: "Erro de conectividade",
        description: connectionTest.error,
        variant: "destructive",
      });
      return null;
    }

    // Configurar webhook automaticamente usando o endpoint do Supabase
    const webhookUrl = instanceData.webhook || `https://obtpghqvrygzcukdaiej.supabase.co/functions/v1/whatsapp-webhook-evolution`;

    const result = await executeWithErrorHandling(
      () => service!.createInstance({
        instanceName: instanceData.instanceName,
        token: instanceData.instanceName,
        qrcode: true,
        number: instanceData.number,
        integration: "WHATSAPP-BAILEYS",
        webhook: webhookUrl,
        webhook_by_events: true,
        events: [
          "APPLICATION_STARTUP",
          "QRCODE_UPDATED", 
          "MESSAGES_SET",
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE",
          "MESSAGES_DELETE",
          "SEND_MESSAGE",
          "CONTACTS_SET",
          "CONTACTS_UPSERT", 
          "CONTACTS_UPDATE",
          "PRESENCE_UPDATE",
          "CHATS_SET",
          "CHATS_UPSERT",
          "CHATS_UPDATE", 
          "CHATS_DELETE",
          "GROUPS_UPSERT",
          "GROUP_UPDATE",
          "GROUP_PARTICIPANTS_UPDATE",
          "CONNECTION_UPDATE",
          "CALL",
          "NEW_JWT_TOKEN",
          "TYPEBOT_START", 
          "TYPEBOT_CHANGE_STATUS"
        ],
        reject_call: true,
        msg_call: "Chamadas não são atendidas",
        groups_ignore: true,
        always_online: true,
        read_messages: true,
        read_status: true,
        websocket_enabled: true,
        websocket_events: ["APPLICATION_STARTUP"]
      }),
      'Criar instância'
    );

    return result;
  }, [service, executeWithErrorHandling, testApiConnection, toast]);

  const configureCompleteWebhook = useCallback(async (instanceName: string) => {
    const webhookUrl = `https://obtpghqvrygzcukdaiej.supabase.co/functions/v1/whatsapp-webhook-evolution`;
    
    return executeWithErrorHandling(
      () => service!.configureCompleteWebhook(instanceName, webhookUrl),
      'Configurar webhook completo'
    );
  }, [service, executeWithErrorHandling]);

  const fetchInstances = useCallback(async () => {
    return executeWithErrorHandling(
      () => service!.fetchInstances(),
      'Buscar instâncias'
    );
  }, [service, executeWithErrorHandling]);

  const connectInstance = useCallback(async (instanceName: string) => {
    return executeWithErrorHandling(
      () => service!.connectInstance(instanceName),
      'Conectar instância'
    );
  }, [service, executeWithErrorHandling]);

  const restartInstance = useCallback(async (instanceName: string) => {
    return executeWithErrorHandling(
      () => service!.restartInstance(instanceName),
      'Reiniciar instância'
    );
  }, [service, executeWithErrorHandling]);

  const getConnectionState = useCallback(async (instanceName: string) => {
    return executeWithErrorHandling(
      () => service!.getConnectionState(instanceName),
      'Verificar estado da conexão',
      false // Não mostrar toast de erro para verificação de estado
    );
  }, [service, executeWithErrorHandling]);

  const deleteInstance = useCallback(async (instanceName: string) => {
    return executeWithErrorHandling(
      async () => {
        // 1. Deletar da Evolution API
        const apiResult = await service!.deleteInstance(instanceName);
        
        // 2. Se sucesso na API, deletar do banco local
        if (apiResult && !apiResult.error) {
          try {
            const { error: dbError } = await supabase
              .from('evolution_api_config')
              .delete()
              .eq('instance_name', instanceName);
            
            if (dbError) {
              logger.error('Erro ao deletar instância do banco local', {
                component: 'useEvolutionAPIComplete',
                metadata: { instanceName }
              }, dbError);
              // Não falhar a operação se o banco falhou, mas logar o erro
            } else {
              logger.info('Instância deletada do banco local com sucesso', {
                component: 'useEvolutionAPIComplete',
                metadata: { instanceName }
              });
            }
          } catch (dbError) {
            logger.error('Erro ao deletar instância do banco local', {
              component: 'useEvolutionAPIComplete',
              metadata: { instanceName }
            }, dbError as Error);
          }
        }
        
        return apiResult;
      },
      'Deletar instância'
    );
  }, [service, executeWithErrorHandling]);

  // ===== OPERAÇÕES DE MENSAGEM =====
  const sendText = useCallback(async (instanceName: string, data: {
    number: string;
    text: string;
    delay?: number;
    linkPreview?: boolean;
  }) => {
    return executeWithErrorHandling(
      () => service!.sendText(instanceName, data),
      'Enviar mensagem de texto'
    );
  }, [service, executeWithErrorHandling]);

  const sendButtons = useCallback(async (instanceName: string, data: {
    number: string;
    buttonMessage: {
      text: string;
      buttons: Array<{
        id: string;
        text: string;
      }>;
      footer?: string;
    };
  }) => {
    return executeWithErrorHandling(
      () => service!.sendButtons(instanceName, data),
      'Enviar mensagem com botões'
    );
  }, [service, executeWithErrorHandling]);

  const sendMedia = useCallback(async (instanceName: string, data: {
    number: string;
    media: string;
    caption?: string;
    filename?: string;
  }) => {
    return executeWithErrorHandling(
      () => service!.sendMedia(instanceName, data),
      'Enviar mídia'
    );
  }, [service, executeWithErrorHandling]);

  const sendAudio = useCallback(async (instanceName: string, data: {
    number: string;
    audio: string;
    caption?: string;
  }) => {
    return executeWithErrorHandling(
      () => service!.sendWhatsAppAudio(instanceName, data),
      'Enviar áudio'
    );
  }, [service, executeWithErrorHandling]);

  const sendLocation = useCallback(async (instanceName: string, data: {
    number: string;
    latitude: number;
    longitude: number;
    name?: string;
  }) => {
    return executeWithErrorHandling(
      () => service!.sendLocation(instanceName, data),
      'Enviar localização'
    );
  }, [service, executeWithErrorHandling]);

  const sendContact = useCallback(async (instanceName: string, data: {
    number: string;
    contact: { name: string; phone: string };
  }) => {
    return executeWithErrorHandling(
      () => service!.sendContact(instanceName, data),
      'Enviar contato'
    );
  }, [service, executeWithErrorHandling]);

  const sendList = useCallback(async (instanceName: string, data: {
    number: string;
    title: string;
    buttonText: string;
    sections: Array<{
      title: string;
      rows: Array<{
        title: string;
        description?: string;
        rowId?: string;
      }>;
    }>;
  }) => {
    return executeWithErrorHandling(
      () => service!.sendList(instanceName, data),
      'Enviar lista interativa'
    );
  }, [service, executeWithErrorHandling]);

  const sendPoll = useCallback(async (instanceName: string, data: {
    number: string;
    question: string;
    options: string[];
    multipleSelect?: boolean;
  }) => {
    return executeWithErrorHandling(
      () => service!.sendPoll(instanceName, data),
      'Enviar enquete'
    );
  }, [service, executeWithErrorHandling]);

  // ===== OPERAÇÕES DE CHAT =====
  const markMessageAsRead = useCallback(async (instanceName: string, messageId: string) => {
    return executeWithErrorHandling(
      () => service!.markMessageAsRead(instanceName, messageId),
      'Marcar mensagem como lida'
    );
  }, [service, executeWithErrorHandling]);

  const findMessages = useCallback(async (instanceName: string, data: {
    chatId: string;
    limit?: number;
    offset?: number;
  }) => {
    return executeWithErrorHandling(
      () => service!.findMessages(instanceName, data),
      'Buscar mensagens'
    );
  }, [service, executeWithErrorHandling]);

  const findChats = useCallback(async (instanceName: string) => {
    return executeWithErrorHandling(
      () => service!.findChats(instanceName),
      'Buscar chats'
    );
  }, [service, executeWithErrorHandling]);

  const checkIsWhatsApp = useCallback(async (instanceName: string, number: string) => {
    return executeWithErrorHandling(
      () => service!.checkIsWhatsApp(instanceName, number),
      'Verificar WhatsApp'
    );
  }, [service, executeWithErrorHandling]);

  // ===== OPERAÇÕES DE WEBHOOK =====
  const setWebhook = useCallback(async (instanceName: string, config: {
    url: string;
    events: string[];
    webhook_by_events?: boolean;
  }) => {
    return executeWithErrorHandling(
      () => service!.setWebhook(instanceName, config),
      'Configurar webhook'
    );
  }, [service, executeWithErrorHandling]);


  const checkWebhookStatus = useCallback(async (instanceName: string) => {
    if (!service) {
      return { configured: false, error: 'Serviço não inicializado' };
    }
    
    return await service.checkWebhookStatus(instanceName);
  }, [service]);

  const findWebhook = useCallback(async (instanceName: string) => {
    return executeWithErrorHandling(
      () => service!.getWebhook(instanceName),
      'Buscar configuração de webhook',
      false // Não mostrar toast de erro para verificação de webhook
    );
  }, [service, executeWithErrorHandling]);

  const reconfigureWebhook = useCallback(async (instanceName: string) => {
    const webhookUrl = `https://obtpghqvrygzcukdaiej.supabase.co/functions/v1/whatsapp-webhook-evolution`;
    
    // Primeiro verificar status atual
    const status = await checkWebhookStatus(instanceName);
    
    if (!status.configured || status.url !== webhookUrl) {
      // Reconfigurar webhook com todos os eventos
      const result = await configureCompleteWebhook(instanceName);
      
      if (result) {
        toast({
          title: "Webhook reconfigurado",
          description: "Webhook foi configurado com sucesso com todos os eventos",
        });
      }
      
      return result;
    }
    
    toast({
      title: "Webhook já configurado",
      description: "Webhook já está corretamente configurado",
    });
    
    return { configured: true };
  }, [checkWebhookStatus, configureCompleteWebhook, toast]);

  // ===== OPERAÇÕES DE PERFIL =====
  const updateProfileName = useCallback(async (instanceName: string, name: string) => {
    return executeWithErrorHandling(
      () => service!.updateProfileName(instanceName, name),
      'Atualizar nome do perfil'
    );
  }, [service, executeWithErrorHandling]);

  const updateProfileStatus = useCallback(async (instanceName: string, status: string) => {
    return executeWithErrorHandling(
      () => service!.updateProfileStatus(instanceName, status),
      'Atualizar status do perfil'
    );
  }, [service, executeWithErrorHandling]);

  // ===== OPERAÇÕES DE GRUPO =====
  const createGroup = useCallback(async (instanceName: string, data: {
    subject: string;
    participants: string[];
    description?: string;
  }) => {
    return executeWithErrorHandling(
      () => service!.createGroup(instanceName, data),
      'Criar grupo'
    );
  }, [service, executeWithErrorHandling]);

  const fetchAllGroups = useCallback(async (instanceName: string) => {
    return executeWithErrorHandling(
      () => service!.fetchAllGroups(instanceName),
      'Buscar todos os grupos'
    );
  }, [service, executeWithErrorHandling]);

  // Carrega configuração ao montar o hook
  useEffect(() => {
    loadGlobalConfig();
  }, [loadGlobalConfig]);

  return {
    // Estado
    config,
    instanceConfig,
    service,
    loading,
    error,
    isServiceAvailable: isServiceAvailable(),

    // Operações de configuração
    loadGlobalConfig,
    testApiConnection,

    // Operações de instância
    createInstance,
    fetchInstances,
    connectInstance,
    restartInstance,
    getConnectionState,
    deleteInstance,

    // Operações de mensagem
    sendText,
    sendButtons,
    sendMedia,
    sendAudio,
    sendLocation,
    sendContact,
    sendList,
    sendPoll,

    // Operações de chat
    markMessageAsRead,
    findMessages,
    findChats,
    checkIsWhatsApp,

    // Operações de webhook
    setWebhook,
    configureCompleteWebhook,
    checkWebhookStatus,
    findWebhook,
    reconfigureWebhook,

    // Operações de perfil
    updateProfileName,
    updateProfileStatus,

    // Operações de grupo
    createGroup,
    fetchAllGroups,
  };
}

export default useEvolutionAPIComplete;
