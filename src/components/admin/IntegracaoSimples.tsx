import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Settings, Edit, Save, X, MessageSquare, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useEvolutionApiConfig } from '@/contexts/EvolutionApiContext';
interface EvolutionConfig {
  id?: string;
  server_url: string;
  api_key: string;
  ativo: boolean;
}
export default function IntegracaoSimples() {
  const [configGlobal, setConfigGlobal] = useState<EvolutionConfig>({
    server_url: '',
    api_key: '',
    ativo: false
  });
  const [loading, setLoading] = useState(true);
  const [testando, setTestando] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [configSalva, setConfigSalva] = useState(false);
  const {
    toast
  } = useToast();
  const {
    config: globalConfig,
    updateConfig,
    isConfigured
  } = useEvolutionApiConfig();

  // Usar dados do contexto global
  useEffect(() => {
    if (globalConfig) {
      setConfigGlobal({
        id: globalConfig.id,
        server_url: globalConfig.server_url,
        api_key: globalConfig.api_key,
        ativo: globalConfig.ativo
      });
      setConfigSalva(true);
      setModoEdicao(false);
    } else {
      setModoEdicao(true);
      setConfigSalva(false);
    }
    setLoading(false);
  }, [globalConfig, isConfigured]);
  const salvarConfiguracao = async () => {
    if (!configGlobal.server_url || !configGlobal.api_key) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }
    setTestando(true);
    const sucesso = await updateConfig({
      server_url: configGlobal.server_url,
      api_key: configGlobal.api_key,
      webhook_base_url: 'https://obtpghqvrygzcukdaiej.supabase.co/functions/v1/whatsapp-webhook-evolution'
    });
    if (sucesso) {
      setConfigSalva(true);
      setModoEdicao(false);
      toast({
        title: "Configuração salva",
        description: "Evolution API configurada com sucesso. Agora você pode gerenciar instâncias na aba 'Instâncias'."
      });
    }
    setTestando(false);
  };
  const habilitarEdicao = () => {
    setModoEdicao(true);
  };
  const cancelarEdicao = () => {
    setModoEdicao(false);
    // Restaurar configuração original do contexto global
    if (globalConfig) {
      setConfigGlobal({
        id: globalConfig.id,
        server_url: globalConfig.server_url,
        api_key: globalConfig.api_key,
        ativo: globalConfig.ativo
      });
    }
  };
  if (loading) {
    return <div className="space-y-6">
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
            <div className="h-8 bg-muted rounded w-1/2"></div>
          </CardContent>
        </Card>
      </div>;
  }
  return <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Configuração da Evolution API</h2>
        <p className="text-muted-foreground">Configure a conexão global com sua Evolution API</p>
      </div>

      {/* Configuração da Evolution API */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuração Global
            {isConfigured && <Badge className="bg-green-100 text-green-800">Conectado</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {configSalva && !modoEdicao ?
        // Modo de visualização
        <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">URL do Servidor</Label>
                  <div className="p-3 bg-muted/50 rounded-md border">
                    <p className="text-sm font-mono">{configGlobal.server_url}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Chave da API</Label>
                  <div className="p-3 bg-muted/50 rounded-md border">
                    <p className="text-sm">••••••••••••••••</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={habilitarEdicao}>
                  <Edit className="w-4 h-4 mr-2" />
                  Editar Configuração
                </Button>
              </div>
            </div> :
        // Modo de edição/criação
        <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="server_url">URL do Servidor</Label>
                  <Input id="server_url" placeholder="https://sua-evolution-api.com" value={configGlobal.server_url} onChange={e => setConfigGlobal(prev => ({
                ...prev,
                server_url: e.target.value
              }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api_key">Chave da API</Label>
                  <Input id="api_key" type="password" placeholder="Sua chave da API" value={configGlobal.api_key} onChange={e => setConfigGlobal(prev => ({
                ...prev,
                api_key: e.target.value
              }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={salvarConfiguracao} disabled={testando}>
                  <Save className="w-4 h-4 mr-2" />
                  {testando ? 'Salvando...' : 'Salvar e Testar'}
                </Button>
                {configSalva && <Button variant="outline" onClick={cancelarEdicao}>
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>}
              </div>
            </div>}

          {/* Informações sobre configuração */}
          
        </CardContent>
      </Card>

      {/* Card de gerenciamento de instâncias */}
      {isConfigured}

      {/* Aviso se não estiver conectado */}
      {!isConfigured && <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="w-5 h-5" />
              <div>
                <div className="font-medium">Configuração Necessária</div>
                <div className="text-sm">Configure a Evolution API acima para começar a usar o WhatsApp</div>
              </div>
            </div>
          </CardContent>
        </Card>}
    </div>;
}