/**
 * Registro e gerenciamento do Service Worker
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface ServiceWorkerContextType {
  isSupported: boolean;
  isRegistered: boolean;
  isOffline: boolean;
  cacheSize: number;
  updateAvailable: boolean;
  registerSW: () => Promise<void>;
  unregisterSW: () => Promise<void>;
  updateSW: () => Promise<void>;
  clearCache: () => Promise<void>;
  getCacheSize: () => Promise<number>;
}

const ServiceWorkerContext = createContext<ServiceWorkerContextType | undefined>(undefined);

export function useServiceWorker() {
  const context = useContext(ServiceWorkerContext);
  if (!context) {
    throw new Error('useServiceWorker must be used within ServiceWorkerProvider');
  }
  return context;
}

interface ServiceWorkerProviderProps {
  children: React.ReactNode;
}

export function ServiceWorkerProvider({ children }: ServiceWorkerProviderProps) {
  const [isSupported] = useState('serviceWorker' in navigator);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [cacheSize, setCacheSize] = useState(0);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  
  const { toast } = useToast();

  // Monitorar status online/offline
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast({
        title: "Conexão restabelecida",
        description: "Você está online novamente",
        variant: "default"
      });
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast({
        title: "Você está offline",
        description: "Algumas funcionalidades podem estar limitadas",
        variant: "destructive"
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  // Registrar service worker
  const registerSW = async () => {
    if (!isSupported) {
      throw new Error('Service Worker não é suportado');
    }

    try {
      const reg = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      setRegistration(reg);
      setIsRegistered(true);

      // Verificar atualizações
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
            toast({
              title: "Atualização disponível",
              description: "Uma nova versão está disponível"
            });
          }
        });
      });

      // Receber mensagens do SW
      navigator.serviceWorker.addEventListener('message', handleSWMessage);

      toast({
        title: "Modo offline ativado",
        description: "O app funcionará offline",
        variant: "default"
      });

    } catch (error) {
      console.error('Erro ao registrar service worker:', error);
      throw error;
    }
  };

  // Desregistrar service worker
  const unregisterSW = async () => {
    if (!registration) return;

    await registration.unregister();
    setIsRegistered(false);
    setRegistration(null);
    
    toast({
      title: "Modo offline desativado",
      description: "O service worker foi removido",
      variant: "default"
    });
  };

  // Atualizar service worker
  const updateSW = async () => {
    if (!registration || !registration.waiting) return;

    // Enviar mensagem para ativar novo SW
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Recarregar página após atualização
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  };

  // Limpar cache
  const clearCache = async (): Promise<void> => {
    if (!navigator.serviceWorker.controller) return;

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = () => {
        setCacheSize(0);
        toast({
          title: "Cache limpo",
          description: "Todos os dados em cache foram removidos",
          variant: "default"
        });
        resolve();
      };

      navigator.serviceWorker.controller.postMessage(
        { type: 'CLEAR_CACHE' },
        [messageChannel.port2]
      );
    });
  };

  // Obter tamanho do cache
  const getCacheSize = async (): Promise<number> => {
    if (!navigator.serviceWorker.controller) return 0;

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        const size = event.data.size || 0;
        setCacheSize(size);
        resolve(size);
      };

      navigator.serviceWorker.controller.postMessage(
        { type: 'GET_CACHE_SIZE' },
        [messageChannel.port2]
      );
    });
  };

  // Manipular mensagens do service worker
  const handleSWMessage = (event: MessageEvent) => {
    const { data } = event;
    
    if (data.type === 'CACHE_UPDATED') {
      getCacheSize();
    }
    
    if (data.type === 'OFFLINE_READY') {
      toast({
        title: "App pronto para uso offline",
        description: "Recursos principais foram armazenados",
        variant: "default"
      });
    }
  };

  // Auto-registro no mount
  useEffect(() => {
    if (isSupported && !isRegistered) {
      registerSW().catch(console.error);
    }
  }, [isSupported]);

  // Atualizar tamanho do cache periodicamente
  useEffect(() => {
    if (isRegistered) {
      getCacheSize();
      
      const interval = setInterval(getCacheSize, 30000); // 30 segundos
      return () => clearInterval(interval);
    }
  }, [isRegistered]);

  const value = {
    isSupported,
    isRegistered,
    isOffline,
    cacheSize,
    updateAvailable,
    registerSW,
    unregisterSW,
    updateSW,
    clearCache,
    getCacheSize
  };

  return (
    <ServiceWorkerContext.Provider value={value}>
      {children}
    </ServiceWorkerContext.Provider>
  );
}

// Componente para status offline
export function OfflineIndicator() {
  const { isOffline } = useServiceWorker();

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-destructive text-destructive-foreground text-center py-2 text-sm z-50">
      📡 Você está offline - Funcionando em modo cache
    </div>
  );
}

// Componente para controle do service worker
export function ServiceWorkerControls() {
  const {
    isSupported,
    isRegistered,
    cacheSize,
    updateAvailable,
    registerSW,
    unregisterSW,
    updateSW,
    clearCache
  } = useServiceWorker();

  if (!isSupported) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h3 className="font-semibold">Controles Offline</h3>
      
      <div className="space-y-2 text-sm">
        <p>Status: {isRegistered ? '✅ Ativo' : '❌ Inativo'}</p>
        <p>Cache: {formatBytes(cacheSize)}</p>
        {updateAvailable && <p className="text-warning">🔄 Atualização disponível</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {!isRegistered ? (
          <button
            onClick={registerSW}
            className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm"
          >
            Ativar Offline
          </button>
        ) : (
          <button
            onClick={unregisterSW}
            className="px-3 py-1 bg-destructive text-destructive-foreground rounded text-sm"
          >
            Desativar Offline
          </button>
        )}

        {updateAvailable && (
          <button
            onClick={updateSW}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
          >
            Atualizar App
          </button>
        )}

        {cacheSize > 0 && (
          <button
            onClick={clearCache}
            className="px-3 py-1 bg-gray-500 text-white rounded text-sm"
          >
            Limpar Cache
          </button>
        )}
      </div>
    </div>
  );
}