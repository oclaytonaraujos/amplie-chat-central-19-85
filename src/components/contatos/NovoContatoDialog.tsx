
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';

interface NovoContato {
  nome: string;
  telefone: string;
  email?: string;
  ultimoAtendente: string;
  setorUltimoAtendimento: string;
  dataUltimaInteracao: string;
  tags: string[];
  status: 'ativo' | 'inativo' | 'bloqueado';
  totalAtendimentos: number;
  atendentesAssociados: {
    setor: string;
    atendente: string;
  }[];
}

interface NovoContatoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContatoAdicionado: (contato: NovoContato) => void;
  dadosIniciais?: Partial<NovoContato>;
  onSave?: (contato: any) => void;
  initialData?: any;
}

export function NovoContatoDialog({ 
  open, 
  onOpenChange, 
  onContatoAdicionado, 
  dadosIniciais,
  onSave,
  initialData
}: NovoContatoDialogProps) {
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    status: 'ativo' as 'ativo' | 'inativo' | 'bloqueado'
  });
  const [tags, setTags] = useState<string[]>([]);
  const [novaTag, setNovaTag] = useState('');

  // Preenche os dados iniciais quando o diálogo abre
  useEffect(() => {
    if (open && dadosIniciais) {
      setFormData({
        nome: dadosIniciais.nome || '',
        telefone: dadosIniciais.telefone || '',
        email: dadosIniciais.email || '',
        status: dadosIniciais.status || 'ativo'
      });
      setTags(dadosIniciais.tags || []);
    } else if (open && !dadosIniciais) {
      // Reset para novo contato sem dados iniciais
      setFormData({
        nome: '',
        telefone: '',
        email: '',
        status: 'ativo'
      });
      setTags([]);
    }
  }, [open, dadosIniciais]);

  const adicionarTag = () => {
    if (novaTag.trim() && !tags.includes(novaTag.trim())) {
      setTags([...tags, novaTag.trim()]);
      setNovaTag('');
    }
  };

  const removerTag = (tagRemover: string) => {
    setTags(tags.filter(tag => tag !== tagRemover));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const novoContato: NovoContato = {
      ...formData,
      ultimoAtendente: dadosIniciais?.ultimoAtendente || 'Ana Silva',
      setorUltimoAtendimento: dadosIniciais?.setorUltimoAtendimento || 'Vendas',
      dataUltimaInteracao: dadosIniciais?.dataUltimaInteracao || new Date().toISOString(),
      tags,
      totalAtendimentos: dadosIniciais?.totalAtendimentos || 0,
      atendentesAssociados: dadosIniciais?.atendentesAssociados || [
        {
          setor: 'Vendas',
          atendente: 'Ana Silva'
        }
      ]
    };

    if (onSave) {
      onSave(novoContato);
    } else {
      onContatoAdicionado(novoContato);
    }
    
    // Reset form
    setFormData({
      nome: '',
      telefone: '',
      email: '',
      status: 'ativo'
    });
    setTags([]);
    setNovaTag('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {dadosIniciais ? 'Salvar Novo Contato' : 'Novo Contato'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="telefone">Telefone *</Label>
            <Input
              id="telefone"
              value={formData.telefone}
              onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
              placeholder="+55 11 99999-9999"
              required
            />
          </div>

          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as any }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
                <SelectItem value="bloqueado">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 mt-2 mb-2">
              {tags.map(tag => (
                <Badge key={tag} variant="secondary" className="flex items-center space-x-1">
                  <span>{tag}</span>
                  <button type="button" onClick={() => removerTag(tag)}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex space-x-2">
              <Input
                placeholder="Nova tag"
                value={novaTag}
                onChange={(e) => setNovaTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), adicionarTag())}
              />
              <Button type="button" onClick={adicionarTag} size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {dadosIniciais ? 'Salvar Contato' : 'Adicionar Contato'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
