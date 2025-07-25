import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EvolutionApiWebhookData {
  event: string;
  instance: string;
  data: any; // Dados flexíveis para diferentes tipos de eventos
  destination?: string;
  source?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const payload: EvolutionApiWebhookData = await req.json()
    console.log('Webhook Evolution API recebido:', {
      event: payload.event,
      instance: payload.instance,
      timestamp: new Date().toISOString()
    })

    // EVENTOS DE CONEXÃO E STATUS
    if (['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'APPLICATION_STARTUP'].includes(payload.event)) {
      console.log('Evento de sistema recebido:', payload.event)
      
      try {
        const updateData: any = {}
        
        if (payload.event === 'QRCODE_UPDATED' && payload.data) {
          // Tratar QR Code - pode vir como string base64 ou objeto
          let qrCodeData = typeof payload.data === 'string' ? payload.data : payload.data.qrcode || payload.data.base64;
          
          if (qrCodeData && !qrCodeData.startsWith('data:image/')) {
            qrCodeData = `data:image/png;base64,${qrCodeData}`;
          }
          
          updateData.qr_code = qrCodeData
          updateData.status = 'connecting'
          updateData.connection_state = 'CONNECTING'
          console.log('QR Code atualizado para instância:', payload.instance)
          
        } else if (payload.event === 'CONNECTION_UPDATE') {
          const state = payload.data?.state || payload.data?.connection || 'DISCONNECTED'
          updateData.connection_state = state
          
          if (state === 'open' || state === 'CONNECTED') {
            updateData.status = 'connected'
            updateData.qr_code = null
            updateData.last_connected_at = new Date().toISOString()
            
            // Extrair número se disponível
            if (payload.data?.instance?.profilePictureUrl) {
              updateData.profile_picture_url = payload.data.instance.profilePictureUrl
            }
            if (payload.data?.instance?.profileName) {
              updateData.profile_name = payload.data.instance.profileName
            }
            
          } else if (state === 'close' || state === 'DISCONNECTED') {
            updateData.status = 'disconnected'
            updateData.qr_code = null
          }
          
        } else if (payload.event === 'APPLICATION_STARTUP') {
          console.log('Aplicação Evolution API iniciada para instância:', payload.instance)
          updateData.status = 'starting'
        }
        
        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('evolution_api_config')
            .update(updateData)
            .eq('instance_name', payload.instance)
          
          if (updateError) {
            console.error('Erro ao atualizar instância:', updateError)
          } else {
            console.log('Instância atualizada:', payload.instance, updateData)
          }
        }
      } catch (error) {
        console.error('Erro ao processar evento de sistema:', error)
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: `Evento ${payload.event} processado`,
        instance: payload.instance
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // EVENTOS DE CONTATOS E CHATS
    if (['CONTACTS_SET', 'CONTACTS_UPSERT', 'CONTACTS_UPDATE', 'CHATS_SET', 'CHATS_UPSERT', 'CHATS_UPDATE', 'CHATS_DELETE'].includes(payload.event)) {
      console.log(`Evento de dados recebido: ${payload.event} para instância ${payload.instance}`)
      
      // Log dos dados recebidos para análise
      const { error: logError } = await supabase
        .from('chatbot_logs')
        .insert({
          function_name: 'whatsapp-webhook-evolution',
          level: 'info',
          message: `Evento ${payload.event} processado`,
          correlation_id: crypto.randomUUID(),
          metadata: {
            event: payload.event,
            instance: payload.instance,
            dataType: typeof payload.data,
            hasData: !!payload.data
          }
        })
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: `Evento ${payload.event} registrado`,
        instance: payload.instance
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // EVENTOS DE PRESENÇA E CHAMADAS
    if (['PRESENCE_UPDATE', 'CALL', 'NEW_JWT_TOKEN'].includes(payload.event)) {
      console.log(`Evento de presença/sistema: ${payload.event} para instância ${payload.instance}`)
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: `Evento ${payload.event} registrado`,
        instance: payload.instance
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // EVENTOS DE TYPEBOT
    if (['TYPEBOT_START', 'TYPEBOT_CHANGE_STATUS'].includes(payload.event)) {
      console.log(`Evento Typebot: ${payload.event} para instância ${payload.instance}`)
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: `Evento Typebot ${payload.event} registrado`,
        instance: payload.instance
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // EVENTOS DE MENSAGEM
    if (['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'MESSAGES_DELETE', 'SEND_MESSAGE'].includes(payload.event)) {
      // Para MESSAGES_UPSERT, processar apenas mensagens recebidas (não enviadas)
      if (payload.event === 'MESSAGES_UPSERT') {
        if (!payload.data?.key || payload.data.key.fromMe) {
          console.log('Mensagem ignorada - enviada pelo próprio sistema')
          return new Response(JSON.stringify({ success: true, message: 'Mensagem própria ignorada' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          })
        }
      } else {
        // Para outros eventos de mensagem, apenas logar
        console.log(`Evento de mensagem: ${payload.event} para instância ${payload.instance}`)
        return new Response(JSON.stringify({ 
          success: true, 
          message: `Evento ${payload.event} registrado` 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
    } else {
      // Evento não reconhecido ou não suportado
      console.log('Evento não suportado:', payload.event)
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Evento não suportado',
        event: payload.event
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const data = payload.data
    const telefone = data.key.remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '')
    const nomeContato = data.pushName || 'Cliente'

    console.log('Processando mensagem de:', telefone, 'nome:', nomeContato)

    // Extrair conteúdo da mensagem
    let conteudoMensagem = '';
    let tipoMensagem = 'texto';
    let metadata: any = {
      messageId: data.key.id,
      timestamp: data.messageTimestamp,
      remoteJid: data.key.remoteJid,
      instance: payload.instance
    };

    if (data.message?.conversation) {
      conteudoMensagem = data.message.conversation;
    } else if (data.message?.extendedTextMessage) {
      conteudoMensagem = data.message.extendedTextMessage.text;
    } else if (data.message?.imageMessage) {
      tipoMensagem = 'imagem';
      conteudoMensagem = data.message.imageMessage.caption || '';
      metadata.mediaUrl = data.message.imageMessage.url;
      metadata.mimeType = data.message.imageMessage.mimetype;
    } else if (data.message?.documentMessage) {
      tipoMensagem = 'documento';
      conteudoMensagem = data.message.documentMessage.title || data.message.documentMessage.fileName;
      metadata.mediaUrl = data.message.documentMessage.url;
      metadata.mimeType = data.message.documentMessage.mimetype;
      metadata.fileName = data.message.documentMessage.fileName;
    } else if (data.message?.audioMessage) {
      tipoMensagem = 'audio';
      conteudoMensagem = '[Áudio]';
      metadata.mediaUrl = data.message.audioMessage.url;
      metadata.mimeType = data.message.audioMessage.mimetype;
    } else if (data.message?.videoMessage) {
      tipoMensagem = 'video';
      conteudoMensagem = data.message.videoMessage.caption || '[Vídeo]';
      metadata.mediaUrl = data.message.videoMessage.url;
      metadata.mimeType = data.message.videoMessage.mimetype;
    } else if (data.message?.buttonsResponseMessage) {
      tipoMensagem = 'botao_resposta';
      conteudoMensagem = data.message.buttonsResponseMessage.selectedDisplayText;
      metadata.selectedButtonId = data.message.buttonsResponseMessage.selectedButtonId;
    } else if (data.message?.listResponseMessage) {
      tipoMensagem = 'lista_resposta';
      conteudoMensagem = data.message.listResponseMessage.singleSelectReply.selectedRowId;
      metadata.selectedRowId = data.message.listResponseMessage.singleSelectReply.selectedRowId;
    }

    if (!conteudoMensagem) {
      console.log('Tipo de mensagem não suportado:', data.message);
      return new Response(JSON.stringify({ success: true, message: 'Tipo de mensagem não suportado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Buscar ou criar contato
    let { data: contato, error: contatoError } = await supabase
      .from('contatos')
      .select('*')
      .eq('telefone', telefone)
      .single()

    if (contatoError && contatoError.code === 'PGRST116') {
      console.log('Criando novo contato para:', telefone)
      
      // Buscar empresa ativa por instância Evolution API
      const { data: evolutionConfig } = await supabase
        .from('evolution_api_config')
        .select('empresa_id')
        .eq('instance_name', payload.instance)
        .eq('ativo', true)
        .single()

      if (!evolutionConfig) {
        console.log('Nenhuma configuração Evolution API encontrada para instância:', payload.instance)
        // Fallback para primeira empresa ativa
        const { data: empresa } = await supabase
          .from('empresas')
          .select('id')
          .eq('ativo', true)
          .limit(1)
          .single()

        if (!empresa) {
          throw new Error('Nenhuma empresa ativa encontrada')
        }

        evolutionConfig.empresa_id = empresa.id
      }

      const { data: novoContato, error: criarContatoError } = await supabase
        .from('contatos')
        .insert({
          nome: nomeContato,
          telefone: telefone,
          empresa_id: evolutionConfig.empresa_id
        })
        .select()
        .single()

      if (criarContatoError) {
        throw criarContatoError
      }

      contato = novoContato
    } else if (contatoError) {
      throw contatoError
    }

    console.log('Contato encontrado/criado:', contato?.id)

    // Buscar conversa ativa para este contato
    let { data: conversa, error: conversaError } = await supabase
      .from('conversas')
      .select('*')
      .eq('contato_id', contato!.id)
      .in('status', ['ativo', 'em-atendimento'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    let novaConversa = false
    if (conversaError && conversaError.code === 'PGRST116') {
      console.log('Criando nova conversa para contato:', contato!.id)
      
      const { data: novaConversaData, error: criarConversaError } = await supabase
        .from('conversas')
        .insert({
          contato_id: contato!.id,
          empresa_id: contato!.empresa_id,
          status: 'ativo',
          canal: 'whatsapp',
          prioridade: 'normal'
        })
        .select()
        .single()

      if (criarConversaError) {
        throw criarConversaError
      }

      conversa = novaConversaData
      novaConversa = true
    } else if (conversaError) {
      throw conversaError
    }

    console.log('Conversa encontrada/criada:', conversa?.id)

    // Inserir mensagem do cliente
    const { data: mensagem, error: mensagemError } = await supabase
      .from('mensagens')
      .insert({
        conversa_id: conversa!.id,
        conteudo: conteudoMensagem,
        remetente_tipo: 'cliente',
        remetente_nome: nomeContato,
        tipo_mensagem: tipoMensagem,
        metadata: metadata
      })
      .select()
      .single()

    if (mensagemError) {
      throw mensagemError
    }

    console.log('Mensagem inserida:', mensagem.id)

    // Verificar se deve iniciar o chatbot ou processar resposta
    if (novaConversa) {
      // Nova conversa - iniciar fluxo do chatbot
      console.log('Iniciando fluxo do chatbot para nova conversa')
      
      try {
        const chatbotResponse = await fetch(`${supabaseUrl}/functions/v1/chatbot-engine`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            conversaId: conversa!.id,
            iniciarFluxo: true
          })
        })

        const chatbotResult = await chatbotResponse.json()
        console.log('Resultado do chatbot:', chatbotResult)
      } catch (chatbotError) {
        console.error('Erro ao iniciar chatbot:', chatbotError)
      }
    } else {
      // Conversa existente - verificar se há sessão ativa do chatbot
      const { data: sessaoAtiva } = await supabase
        .from('chatbot_sessions')
        .select('*')
        .eq('conversa_id', conversa!.id)
        .eq('status', 'ativo')
        .single()

      if (sessaoAtiva) {
        console.log('Processando resposta do chatbot')
        
        try {
          const chatbotResponse = await fetch(`${supabaseUrl}/functions/v1/chatbot-engine`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({
              conversaId: conversa!.id,
              mensagemCliente: conteudoMensagem,
              tipoMensagem: tipoMensagem
            })
          })

          const chatbotResult = await chatbotResponse.json()
          console.log('Resultado do chatbot:', chatbotResult)
        } catch (chatbotError) {
          console.error('Erro ao processar chatbot:', chatbotError)
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mensagem Evolution API processada com sucesso',
        conversaId: conversa!.id,
        mensagemId: mensagem.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Erro ao processar webhook Evolution API:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})