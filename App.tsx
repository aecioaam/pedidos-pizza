
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  PizzaSabor,
  OrderState,
  PizzaInOrder,
  Order
} from './types';
import {
  SIZE_OPTIONS,
  BORDA_PRICES,
  DELIVERY_FEE,
  WHATSAPP_NUMBER,
  NOTIFICATION_SOUND
} from './constants';
import { supabase } from './src/supabaseClient';
import {
  ShoppingBag,
  Plus,
  Minus,
  Phone,
  X,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Pizza,
  ReceiptText,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Heart,
  RotateCcw,
  Info,
  Settings,
  LogIn,
  Printer,
  Bell,
  CheckCircle,
  Clock,
  LogOut,
  Store,
  Lock,
  Unlock,
  Save,
  Loader2
} from 'lucide-react';

const generateId = () => Math.random().toString(36).substr(2, 9);

const createEmptyPizza = (): PizzaInOrder => ({
  id: generateId(),
  type: 'whole',
  whole: null,
  half1: null,
  half2: null,
  size: null,
  sizePrice: 0,
  bordaType: 'normal',
  bordaPrice: 0
});

const initialState: OrderState = {
  pizzas: [createEmptyPizza()],
  refrigerantes: [],
  customerInfo: {
    name: "",
    orderType: "retirada",
    rua: "",
    numero: "",
    bairro: "",
    address: "",
    reference: "",
    paymentMethod: "cartao",
    changeFor: "",
    observations: ""
  },
  total: 0
};

export default function App() {
  const [viewMode, setViewMode] = useState<'customer' | 'admin-login' | 'admin-dashboard'>('customer');
  const [step, setStep] = useState(1);
  const [triedToAdvance, setTriedToAdvance] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [order, setOrder] = useState<OrderState>(initialState);

  // Admin State
  const [orders, setOrders] = useState<Order[]>([]);
  const [adminUser, setAdminUser] = useState<boolean>(false);
  const [selectedOrderToPrint, setSelectedOrderToPrint] = useState<Order | null>(null);

  // Login State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [storeSettings, setStoreSettings] = useState({ isOpen: true, closedMessage: 'Estamos fechados no momento. Voltamos em breve!', businessHours: 'Sexta a Domingo das 18h às 23h' });
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);

  // Menu State
  const [flavorsList, setFlavorsList] = useState<any[]>([]);
  const [beveragesList, setBeveragesList] = useState<any[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);

  // Admin Menu Management State
  const [newFlavor, setNewFlavor] = useState({ name: '', ingredients: '' });
  const [newBeverage, setNewBeverage] = useState({ name: '', price: '' });

  // Admin Tabs
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'settings'>('orders');

  const [deliveryFee, setDeliveryFee] = useState(0);
  const [pixCopied, setPixCopied] = useState(false);

  const lastOrderCount = useRef(0);
  const notificationAudio = useRef<HTMLAudioElement | null>(null);

  // Load and save orders from LocalStorage
  // Load and subscribe to orders from Supabase
  useEffect(() => {
    // Carregar pedidos iniciais
    const fetchOrders = async () => {
      const { data } = await supabase.from('orders').select('content');
      if (data) {
        const loadedOrders = data.map((row: any) => row.content);
        setOrders(loadedOrders);
        lastOrderCount.current = loadedOrders.length;
      }
    };
    fetchOrders();

    // Monitoramento Realtime
    const channel = supabase
      .channel('realtime_orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const newOrder = payload.new.content as Order;
          setOrders(prev => {
            if (prev.some(o => o.id === newOrder.id)) return prev;
            return [...prev, newOrder];
          });
        }
      )
      .subscribe();

    // Auth State Listener
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setAdminUser(true);
        setViewMode('admin-dashboard');
      } else {
        setAdminUser(false);
        // Only switch to customer view if currently in dashboard, to allow login screen access
        // But for simplicity/logic flow:
        if (viewMode === 'admin-dashboard') {
          setViewMode('customer');
        }
      }
    });

    // Init notification sound
    notificationAudio.current = new Audio(NOTIFICATION_SOUND);
    notificationAudio.current.volume = 1.0;

    return () => {
      supabase.removeChannel(channel);
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Fetch initial store settings
    const fetchSettings = async () => {
      const { data } = await supabase.from('store_settings').select('*').eq('id', 1).single();
      if (data) {
        setStoreSettings({
          isOpen: data.is_open,
          closedMessage: data.closed_message,
          businessHours: data.business_hours || 'Sexta a Domingo das 18h às 23h'
        });
      }
      setIsSettingsLoading(false);
    };
    fetchSettings();

    // Store Settings Realtime
    const settingsChannel = supabase
      .channel('store_settings_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'store_settings', filter: 'id=eq.1' },
        (payload) => {
          const newData = payload.new;
          setStoreSettings({
            isOpen: newData.is_open,
            closedMessage: newData.closed_message,
            businessHours: newData.business_hours || 'Sexta a Domingo das 18h às 23h'
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(settingsChannel);
    }
  }, []);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        setMenuLoading(true);

        // Fetch Flavors
        const { data: flavors, error: flavorsError } = await supabase
          .from('pizza_flavors')
          .select('*')
          .order('name');

        if (flavorsError) throw flavorsError;
        if (flavors) setFlavorsList(flavors);

        // Fetch Beverages
        const { data: beverages, error: beveragesError } = await supabase
          .from('beverages')
          .select('*')
          .order('name');

        if (beveragesError) throw beveragesError;
        if (beverages) setBeveragesList(beverages);

      } catch (error) {
        console.error('Erro ao carregar cardápio:', error);
      } finally {
        setMenuLoading(false);
      }
    };

    fetchMenu();
  }, []);

  useEffect(() => {
    // localStorage.setItem('chalé_orders', JSON.stringify(orders)); // Removido persistência local

    // Play sound if new order arrives
    if (orders.length > lastOrderCount.current) {
      const latestOrder = orders[orders.length - 1];
      if (latestOrder.status === 'pending') {
        const playSound = () => {
          if (notificationAudio.current) {
            notificationAudio.current.currentTime = 0;
            notificationAudio.current.play().catch(e => console.log("Audio play blocked"));
          }
        };

        // Play 3 times
        playSound();
        setTimeout(playSound, 1000);
        setTimeout(playSound, 2000);
      }
    }
    lastOrderCount.current = orders.length;
  }, [orders]);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    pizzaId: string;
    type: 'whole' | 'half';
    halfNum: 1 | 2 | null;
  }>({
    isOpen: false,
    pizzaId: '',
    type: 'whole',
    halfNum: null
  });

  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);

  const withdrawalDiscount = useMemo(() => {
    if (order.customerInfo.orderType !== 'retirada') return 0;

    let discount = 0;
    order.pizzas.forEach(p => {
      // Regra: Desconto de R$ 5,00 para pizzas M, G ou GG na retirada
      // Se for "P" (Pequena), NÃO tem desconto.
      if (p.size && p.size !== 'P') {
        discount += 5;
      }
    });
    return discount;
  }, [order.pizzas, order.customerInfo.orderType]);

  const currentTotal = useMemo(() => {
    let subtotal = 0;
    order.pizzas.forEach(p => {
      subtotal += p.sizePrice + p.bordaPrice;
    });
    order.refrigerantes.forEach(r => subtotal += r.price);

    if (order.customerInfo.orderType === 'entrega') {
      subtotal += deliveryFee;
    } else {
      subtotal -= withdrawalDiscount;
    }

    // Garantir que não fique negativo (embora improvável com essas regras)
    return Math.max(0, subtotal);
  }, [order.pizzas, order.refrigerantes, order.customerInfo.orderType, deliveryFee, withdrawalDiscount]);

  useEffect(() => {
    setOrder(prev => ({ ...prev, total: currentTotal }));
  }, [currentTotal]);

  const addPizza = () => {
    setOrder(prev => ({ ...prev, pizzas: [...prev.pizzas, createEmptyPizza()] }));
  };

  const removePizza = (id: string) => {
    if (order.pizzas.length > 1) {
      setOrder(prev => ({ ...prev, pizzas: prev.pizzas.filter(p => p.id !== id) }));
    }
  };

  const updatePizza = (id: string, updates: Partial<PizzaInOrder>) => {
    setOrder(prev => ({
      ...prev,
      pizzas: prev.pizzas.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
  };

  const selectSabor = (sabor: PizzaSabor) => {
    const { pizzaId, type, halfNum } = modalConfig;
    const pizza = order.pizzas.find(p => p.id === pizzaId);
    if (!pizza) return;

    if (type === 'whole') {
      updatePizza(pizzaId, { whole: sabor });
    } else {
      if (halfNum === 1) {
        if (pizza.half2?.name === sabor.name) {
          alert("⚠️ Escolha um sabor diferente para a outra metade.");
          return;
        }
        updatePizza(pizzaId, { half1: sabor });
      } else {
        if (pizza.half1?.name === sabor.name) {
          alert("⚠️ Escolha um sabor diferente para a outra metade.");
          return;
        }
        updatePizza(pizzaId, { half2: sabor });
      }
    }
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const handleNextStep = () => {
    setTriedToAdvance(true);

    if (step === 1) {
      const hasIncompletePizza = order.pizzas.some(p =>
        !p.size ||
        (p.type === 'whole' && !p.whole) ||
        (p.type === 'half' && (!p.half1 || !p.half2))
      );
      if (hasIncompletePizza) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    if (step === 3) {
      const info = order.customerInfo;
      const isNameMissing = !info.name.trim();
      const isDeliveryAddressMissing = info.orderType === 'entrega' && (!info.rua.trim() || !info.numero.trim() || !info.bairro.trim());
      const isChangeMissing = info.paymentMethod === 'dinheiro' && !info.changeFor.trim();

      if (isNameMissing || isDeliveryAddressMissing || isChangeMissing) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    setTriedToAdvance(false);
    setStep(s => Math.min(s + 1, 4));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackStep = () => {
    setTriedToAdvance(false);
    setStep(s => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = () => {
    setOrder(initialState);
    setStep(1);
    setIsFinished(false);
    setTriedToAdvance(false);
    setWhatsappModalOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveOrderLocally = async () => {
    const newOrder: Order = {
      ...order,
      id: generateId(),
      status: 'pending',
      createdAt: Date.now()
    };

    // Salvar no Supabase
    await supabase.from('orders').insert([{ content: newOrder }]);

    setOrders(prev => [...prev, newOrder]);
  };

  const generateWhatsAppMessage = () => {
    const o = order;
    const info = o.customerInfo;
    let msg = `*NOVO PEDIDO - PIZZARIA CHALÉ*\n\n`;
    msg += `*Cliente:* ${info.name}\n`;
    msg += `*Tipo:* ${info.orderType === 'retirada' ? 'Retirada' : 'Entrega'}\n`;

    if (info.orderType === 'entrega') {
      msg += `*Endereço:* ${info.rua}, ${info.numero} - ${info.bairro}\n`;
      if (info.reference.trim()) msg += `*Referência:* ${info.reference}\n`;
    }

    msg += `*Pagamento:* ${info.paymentMethod.toUpperCase()}\n`;
    if (info.paymentMethod === 'dinheiro') msg += `*Troco:* ${info.changeFor}\n`;

    msg += `\n*ÍTENS:*\n`;
    o.pizzas.forEach((p, i) => {
      msg += `Pizza ${i + 1} (${p.size}): ${p.type === 'whole' ? p.whole?.name : `${p.half1?.name} / ${p.half2?.name}`}\n`;
      msg += `Borda: ${p.bordaType === 'normal' ? 'Simples' : 'Recheada'}\n\n`;
    });

    if (o.refrigerantes.length > 0) {
      msg += `*Bebidas:*\n`;
      o.refrigerantes.forEach(r => msg += `- ${r.name}\n`);
    }

    if (info.observations.trim()) {
      msg += `\n*Obs:* ${info.observations}\n`;
    }

    msg += `\n*Total: R$ ${o.total.toFixed(2).replace('.', ',')}*`;
    return `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(msg)}`;
  };

  // Admin Actions
  const handleAdminLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        alert("Erro no login: " + error.message);
      }
      // Success is handled by onAuthStateChange
    } catch (error) {
      alert("Erro inesperado ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    await supabase.auth.signOut();
    setAdminUser(false);
    setViewMode('customer');
  };

  const deleteOrder = async (id: string) => {
    if (confirm("Deseja realmente excluir este pedido?")) {
      await supabase.from('orders').delete().ilike('content->>id', id); // Remove do banco
      setOrders(prev => prev.filter(o => o.id !== id));
    }
  };

  const completeOrder = async (id: string) => {
    const orderToUpdate = orders.find(o => o.id === id);
    if (orderToUpdate) {
      const updated = { ...orderToUpdate, status: 'completed' as const };
      await supabase.from('orders').update({ content: updated }).eq('content->>id', id);
      setOrders(prev => prev.map(o => o.id === id ? updated : o));
    }
  };

  const printOrder = (targetOrder: Order) => {
    const printArea = document.getElementById('print-area');
    if (!printArea) return;

    const info = targetOrder.customerInfo;
    const date = new Date(targetOrder.createdAt).toLocaleString();

    // Group beverages by name for cleaner display
    const beveragesGrouped = targetOrder.refrigerantes.reduce((acc, curr) => {
      acc[curr.name] = (acc[curr.name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    let html = `
      <div style="font-family: sans-serif; color: #000;">
        <!-- CABEÇALHO (ENTREGA) -->
        <div style="text-align: center; margin-bottom: 10px;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 900; line-height: 1.1;">${info.name}</h1>
          ${info.orderType === 'entrega' ? `
            <div style="margin-top: 6px; font-size: 13px; font-weight: 700; line-height: 1.3;">
              ${info.rua}, ${info.numero}
              <br/>${info.bairro}
            </div>
            ${info.reference ? `<div style="font-size: 11px; margin-top: 2px;">(Ref: ${info.reference})</div>` : ''}
          ` : `
            <div style="margin-top: 8px; font-size: 14px; font-weight: 800; border: 2px solid #000; display: inline-block; padding: 2px 6px; letter-spacing: 0.5px;">RETIRADA</div>
          `}
          
          <div style="margin-top: 8px; border-top: 1px solid #000; padding-top: 4px; display: flex; justify-content: space-between; font-size: 10px;">
            <span>#${targetOrder.id.substring(0, 6).toUpperCase()}</span>
            <span>${date}</span>
          </div>
        </div>

        <div style="border-bottom: 2px dashed #000; margin: 10px 0;"></div>

        <!-- CORPO (COZINHA) -->
        <div style="margin-bottom: 10px;">
          ${targetOrder.pizzas.map((p, i) => `
            <div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px dotted #ccc;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-size: 14px; font-weight: 900; background: #000; color: #fff; padding: 1px 6px; border-radius: 2px;">${p.size || 'ND'}</span>
                ${p.bordaType === 'recheada' ? `<span style="font-size: 10px; font-weight: 700; border: 1px solid #000; padding: 0 4px;">BORDA RECHEADA</span>` : ''}
              </div>
              
              <div style="font-size: 13px; font-weight: 800; line-height: 1.3; margin-left: 2px;">
                ${p.type === 'whole'
        ? `<div style="margin-bottom: 2px;">• ${p.whole?.name || 'Sabor não escolhido'}</div>`
        : `<div style="margin-bottom: 2px;">• 1/2 ${p.half1?.name || '...'}</div><div>• 1/2 ${p.half2?.name || '...'}</div>`
      }
              </div>
            </div>
          `).join('')}


          ${/* OBSERVATIONS (First for Kitchen) */ ''}
          ${info.observations.trim() ? `
            <div style="margin-top: 12px; border: 2px solid #000; padding: 6px;">
              <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; margin-bottom: 2px;">OBSERVAÇÕES:</div>
              <div style="font-size: 12px; font-weight: 900; text-transform: uppercase;">
                ${info.observations}
              </div>
            </div>
          ` : ''}

          ${/* BEVERAGES */ ''}
          ${Object.entries(beveragesGrouped).length > 0 ? `
            <div style="margin-top: 6px; padding-top: 4px; border-top: 1px dashed #000;">
              ${Object.entries(beveragesGrouped).map(([name, qty]) => `
                <div style="font-size: 13px; font-weight: 800; margin-bottom: 2px;">
                  ${qty}x ${name}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>

      <!-- RODAPÉ (FINANCEIRO) -->
        <div style="margin-top: 15px; text-align: right; font-size: 11px; border-top: 1px solid #000; padding-top: 8px;">
          <div style="margin-bottom: 2px;">
            Pagamento: <span>${info.paymentMethod.toUpperCase()}</span>
            ${info.paymentMethod === 'dinheiro' && info.changeFor ? ` (Troco para ${info.changeFor})` : ''}
          </div>
          
          ${(() => {
        let printDiscount = 0;
        if (info.orderType === 'retirada') {
          targetOrder.pizzas.forEach(p => {
            if (p.size && p.size !== 'P') {
              printDiscount += 5;
            }
          });
        }
        if (printDiscount > 0) {
          return `
                <div style="margin-bottom: 2px; font-weight: bold;">
                  Desconto Retirada: - R$ ${printDiscount.toFixed(2).replace('.', ',')}
                </div>
              `;
        }
        return '';
      })()}

          <div style="font-size: 12px; font-weight: bold;">
            Total: R$ ${targetOrder.total.toFixed(2).replace('.', ',')}
          </div>
          ${info.orderType === 'entrega' ? `<div style="font-size: 9px;">(Taxa inclusa)</div>` : ''}
        </div>
      </div>
    `;

    printArea.innerHTML = html;
    window.print();
  };

  // ADMIN DASHBOARD VIEW
  if (viewMode === 'admin-dashboard' && adminUser) {
    const pendingOrders = orders.filter(o => o.status === 'pending').sort((a, b) => b.createdAt - a.createdAt);
    const completedOrders = orders.filter(o => o.status === 'completed').sort((a, b) => b.createdAt - a.createdAt);

    return (
      <div className="min-h-screen bg-stone-100 flex flex-col">
        <header className="bg-stone-800 text-white p-6 shadow-md flex justify-between items-center no-print">
          <div className="flex items-center gap-4">
            <div className="bg-rose-600 p-2 rounded-xl">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-serif font-bold">Painel de Pedidos</h1>
              <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Chalé Pizzaria</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 rounded-full border border-green-500/30">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-bold uppercase">Online</span>
            </div>
            <button onClick={handleAdminLogout} className="p-2 hover:bg-stone-700 rounded-lg transition-colors text-stone-300">
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* TAB NAVIGATION */}
        <div className="bg-white border-b border-stone-200 px-6 no-print">
          <div className="max-w-7xl mx-auto flex gap-6">
            <button
              onClick={() => setActiveTab('orders')}
              className={`py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'orders' ? 'border-rose-600 text-rose-600' : 'border-transparent text-stone-500 hover:text-stone-800'}`}
            >
              <ReceiptText size={18} /> Pedidos
            </button>
            <button
              onClick={() => setActiveTab('menu')}
              className={`py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'menu' ? 'border-rose-600 text-rose-600' : 'border-transparent text-stone-500 hover:text-stone-800'}`}
            >
              <Pizza size={18} /> Cardápio
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'settings' ? 'border-rose-600 text-rose-600' : 'border-transparent text-stone-500 hover:text-stone-800'}`}
            >
              <Settings size={18} /> Configurações
            </button>
          </div>
        </div>

        {/* STORE SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="bg-stone-200 p-4 border-b border-stone-300 no-print animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${storeSettings.isOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {storeSettings.isOpen ? <Unlock size={20} /> : <Lock size={20} />}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-stone-700 text-sm">Status da Loja: {storeSettings.isOpen ? 'ABERTA' : 'FECHADA'}</span>
                  <span className="text-[10px] text-stone-500 font-semibold uppercase tracking-wider">Controle de funcionamento</span>
                </div>
              </div>

              <div className="flex flex-1 w-full sm:w-auto flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={storeSettings.closedMessage}
                    onChange={(e) => setStoreSettings(prev => ({ ...prev, closedMessage: e.target.value }))}
                    className="flex-1 px-4 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                    placeholder="Mensagem de fechamento..."
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={storeSettings.businessHours}
                    onChange={(e) => setStoreSettings(prev => ({ ...prev, businessHours: e.target.value }))}
                    className="flex-1 px-4 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                    placeholder="Horário (ex: Terça a Domingo...)"
                  />
                  <button
                    onClick={async () => {
                      await supabase.from('store_settings').update({
                        closed_message: storeSettings.closedMessage,
                        business_hours: storeSettings.businessHours
                      }).eq('id', 1);
                      alert('Configurações atualizadas!');
                    }}
                    className="p-2 bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors"
                    title="Salvar Configurações"
                  >
                    <Save size={18} />
                  </button>
                </div>
              </div>

              <button
                onClick={async () => {
                  const newState = !storeSettings.isOpen;
                  await supabase.from('store_settings').update({ is_open: newState }).eq('id', 1);
                  // State updates via realtime, but optimizing for instant feedback
                  setStoreSettings(prev => ({ ...prev, isOpen: newState }));
                }}
                className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all ${storeSettings.isOpen ? 'bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-200' : 'bg-green-500 text-white hover:bg-green-600 shadow-md shadow-green-200'}`}
              >
                {storeSettings.isOpen ? 'FECHAR LOJA' : 'ABRIR LOJA'}
              </button>
            </div>
          </div>
        )}

        {/* MENU MANAGEMENT TAB */}
        {activeTab === 'menu' && (
          <div className="bg-stone-50 p-6 border-b border-stone-200 no-print animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-xl font-serif font-bold text-stone-800 mb-6 flex items-center gap-2">
                <ReceiptText size={24} className="text-stone-400" />
                Gerenciar Cardápio
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

                {/* SABORES */}
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-stone-100">
                  <h3 className="font-bold text-lg text-stone-700 mb-4 flex items-center gap-2">
                    <Pizza size={20} className="text-rose-500" /> Sabores de Pizza
                  </h3>

                  <div className="flex gap-2 mb-6">
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        placeholder="Nome do Sabor"
                        value={newFlavor.name}
                        onChange={e => setNewFlavor(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-4 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
                      />
                      <input
                        type="text"
                        placeholder="Ingredientes"
                        value={newFlavor.ingredients}
                        onChange={e => setNewFlavor(prev => ({ ...prev, ingredients: e.target.value }))}
                        className="w-full px-4 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        if (!newFlavor.name || !newFlavor.ingredients) return alert('Preencha nome e ingredientes');
                        const { data, error } = await supabase.from('pizza_flavors').insert([{ name: newFlavor.name, ingredients: newFlavor.ingredients }]).select();
                        if (data) {
                          setFlavorsList(prev => [...prev, data[0]]);
                          setNewFlavor({ name: '', ingredients: '' });
                        }
                        if (error) alert('Erro ao adicionar sabor');
                      }}
                      className="bg-stone-800 text-white p-3 rounded-xl hover:bg-stone-700 transition-colors flex items-center justify-center"
                    >
                      <Plus size={20} />
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {flavorsList.map(flavor => (
                      <div key={flavor.id} className="group flex justify-between items-center p-3 bg-stone-50 rounded-xl border border-stone-100 hover:border-stone-300 transition-all">
                        <div>
                          <div className="font-bold text-stone-700 text-sm">{flavor.name}</div>
                          <div className="text-[10px] text-stone-400">{flavor.ingredients}</div>
                        </div>
                        <button
                          onClick={async () => {
                            if (confirm('Excluir este sabor?')) {
                              await supabase.from('pizza_flavors').delete().eq('id', flavor.id);
                              setFlavorsList(prev => prev.filter(f => f.id !== flavor.id));
                            }
                          }}
                          className="text-stone-300 hover:text-red-500 transition-colors p-2"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* BEBIDAS */}
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-stone-100">
                  <h3 className="font-bold text-lg text-stone-700 mb-4 flex items-center gap-2">
                    <ShoppingBag size={20} className="text-blue-500" /> Bebidas
                  </h3>

                  <div className="flex gap-2 mb-6">
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        placeholder="Nome da Bebida"
                        value={newBeverage.name}
                        onChange={e => setNewBeverage(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-4 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                      <input
                        type="number"
                        placeholder="Preço (ex: 15.00)"
                        value={newBeverage.price}
                        onChange={e => setNewBeverage(prev => ({ ...prev, price: e.target.value }))}
                        className="w-full px-4 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        if (!newBeverage.name || !newBeverage.price) return alert('Preencha nome e preço');
                        const { data, error } = await supabase.from('beverages').insert([{ name: newBeverage.name, price: parseFloat(newBeverage.price) }]).select();
                        if (data) {
                          setBeveragesList(prev => [...prev, data[0]]);
                          setNewBeverage({ name: '', price: '' });
                        }
                        if (error) alert('Erro ao adicionar bebida');
                      }}
                      className="bg-stone-800 text-white p-3 rounded-xl hover:bg-stone-700 transition-colors flex items-center justify-center"
                    >
                      <Plus size={20} />
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {beveragesList.map(drink => (
                      <div key={drink.id} className="group flex justify-between items-center p-3 bg-stone-50 rounded-xl border border-stone-100 hover:border-stone-300 transition-all">
                        <div>
                          <div className="font-bold text-stone-700 text-sm">{drink.name}</div>
                          <div className="text-[10px] text-stone-500 font-bold">R$ {parseFloat(drink.price).toFixed(2).replace('.', ',')}</div>
                        </div>
                        <button
                          onClick={async () => {
                            if (confirm('Excluir esta bebida?')) {
                              await supabase.from('beverages').delete().eq('id', drink.id);
                              setBeveragesList(prev => prev.filter(b => b.id !== drink.id));
                            }
                          }}
                          className="text-stone-300 hover:text-red-500 transition-colors p-2"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ORDERS TAB */}
        {
          activeTab === 'orders' && (
            <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full no-print animate-in fade-in slide-in-from-left-4 duration-300">

              <div className="flex justify-end mb-4">
                <button
                  onClick={() => {
                    const audio = new Audio(NOTIFICATION_SOUND);
                    audio.volume = 1.0;
                    audio.play();
                  }}
                  className="text-xs font-bold bg-stone-200 hover:bg-stone-300 px-4 py-2 rounded-xl transition-colors flex items-center gap-2 text-stone-600"
                >
                  🔊 Testar Som
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Coluna Pedidos Pendentes */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-serif font-bold text-stone-800 flex items-center gap-2">
                      <Clock className="text-rose-500" /> Pendentes ({pendingOrders.length})
                    </h2>
                    <div className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider animate-pulse">
                      Monitorando novos pedidos...
                    </div>
                  </div>

                  {pendingOrders.length === 0 ? (
                    <div className="bg-white rounded-[2rem] p-12 text-center border border-stone-200 shadow-sm">
                      <Bell size={48} className="mx-auto text-stone-300 mb-4" />
                      <p className="text-stone-500 font-bold uppercase text-xs tracking-widest">Nenhum pedido pendente no momento</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingOrders.map(o => (
                        <div key={o.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-stone-200 hover:shadow-md transition-shadow">
                          <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-stone-100 pb-4 mb-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black bg-stone-100 px-2 py-0.5 rounded text-stone-500 tracking-tighter">#{o.id.toUpperCase()}</span>
                                <span className="text-stone-400 text-[10px] font-bold uppercase">{new Date(o.createdAt).toLocaleTimeString()}</span>
                              </div>
                              <h3 className="text-lg font-bold text-stone-800">{o.customerInfo.name}</h3>
                              <p className="text-stone-500 text-xs font-medium flex items-center gap-1">
                                {o.customerInfo.orderType === 'entrega' ? <MapPin size={12} /> : <ShoppingBag size={12} />}
                                {o.customerInfo.orderType === 'entrega' ? `${o.customerInfo.rua}, ${o.customerInfo.numero} - ${o.customerInfo.bairro}` : 'Vou Retirar'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-stone-400 text-[10px] font-bold uppercase">Total</p>
                              <p className="text-xl font-serif font-bold text-rose-600">R$ {o.total.toFixed(2).replace('.', ',')}</p>
                              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${o.customerInfo.paymentMethod === 'pix' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                {o.customerInfo.paymentMethod}
                              </span>
                            </div>
                          </div>

                          <div className="mb-6 space-y-2">
                            {o.pizzas.map((p, i) => (
                              <div key={i} className="text-xs font-semibold text-stone-700 bg-stone-50 p-2 rounded-xl border border-stone-100">
                                <span className="text-rose-600 mr-2">#{i + 1}</span>
                                Pizza {p.size} ({p.type === 'whole' ? p.whole?.name : `${p.half1?.name}/${p.half2?.name}`})
                                {p.bordaType === 'recheada' && <span className="ml-2 text-rose-500">Borda Rec.</span>}
                              </div>
                            ))}
                            {o.refrigerantes.length > 0 && (
                              <div className="text-xs text-stone-500 flex flex-wrap gap-2 px-2">
                                {o.refrigerantes.map(r => <span key={r.name}>&bull; {r.name}</span>)}
                              </div>
                            )}
                            {o.customerInfo.observations && (
                              <div className="mt-2 text-[10px] bg-amber-50 text-amber-800 p-2 rounded-lg border border-amber-100 font-medium">
                                <strong>OBS:</strong> {o.customerInfo.observations}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => completeOrder(o.id)}
                              className="flex-1 min-w-[120px] bg-green-600 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-green-700 active:scale-95 transition-all shadow-lg shadow-green-100"
                            >
                              <CheckCircle size={16} /> Concluir
                            </button>
                            <button
                              onClick={() => printOrder(o)}
                              className="flex-1 min-w-[120px] bg-stone-800 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-stone-700 active:scale-95 transition-all"
                            >
                              <Printer size={16} /> Imprimir
                            </button>
                            <button
                              onClick={() => deleteOrder(o.id)}
                              className="p-3 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Coluna Histórico / Concluídos */}
                <div className="space-y-6">
                  <h2 className="text-2xl font-serif font-bold text-stone-800 flex items-center gap-2">
                    <CheckCircle2 className="text-green-500" /> Histórico ({completedOrders.length})
                  </h2>
                  <div className="bg-white rounded-[2rem] border border-stone-200 overflow-hidden">
                    {completedOrders.length === 0 ? (
                      <div className="p-8 text-center text-stone-400 text-xs font-bold uppercase">Nenhum pedido concluído</div>
                    ) : (
                      <div className="divide-y divide-stone-100">
                        {completedOrders.map(o => (
                          <div key={o.id} className="p-4 hover:bg-stone-50 transition-colors group">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-stone-800 font-bold text-xs">{o.customerInfo.name}</span>
                              <span className="text-stone-400 text-[9px] font-bold">{new Date(o.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-stone-500 text-[10px] font-semibold">R$ {o.total.toFixed(2)}</span>
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => printOrder(o)} className="text-stone-400 hover:text-stone-800"><Printer size={14} /></button>
                                <button onClick={() => deleteOrder(o.id)} className="text-stone-400 hover:text-red-600"><Trash2 size={14} /></button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </main>
          )
        }
      </div >
    );
  }

  // LOGIN SCREEN
  if (viewMode === 'admin-login') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white border border-stone-200 rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl text-center">
          <div className="w-20 h-20 bg-stone-100 text-stone-800 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner border-2 border-stone-200">
            <LogIn size={36} />
          </div>
          <h2 className="text-3xl font-serif font-bold text-stone-800 mb-2">Login Admin</h2>
          <p className="text-stone-500 text-xs font-bold uppercase tracking-widest mb-8">Chalé Pizzaria</p>

          <div className="space-y-4 mb-6">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 outline-none font-medium text-stone-800"
            />
            <input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 outline-none font-medium text-stone-800"
            />
          </div>

          <button
            onClick={handleAdminLogin}
            disabled={loading}
            className="w-full bg-stone-800 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-stone-700 transition-all active:scale-95 shadow-xl shadow-stone-200 disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Acessar Painel'}
          </button>

          <button
            onClick={() => setViewMode('customer')}
            className="mt-4 text-stone-400 text-[10px] font-extrabold uppercase hover:text-rose-600 transition-colors"
          >
            Voltar para o Cardápio
          </button>
        </div>
      </div>
    );
  }

  // CUSTOMER FLOW
  if (isFinished) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="bg-white/90 backdrop-blur-sm border border-stone-200 rounded-[3rem] p-12 max-w-lg w-full text-center shadow-2xl shadow-stone-200 animate-in zoom-in fade-in duration-500">
          <div className="w-24 h-24 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner ring-8 ring-green-100/50">
            <Heart size={48} className="fill-green-600" />
          </div>
          <h2 className="text-4xl font-serif font-bold text-stone-800 mb-4">Obrigado pelo Pedido!</h2>
          <p className="text-stone-600 font-medium mb-12 leading-relaxed">
            Sua pizza está sendo preparada com todo carinho. Você pode verificar via WhatsApp sobre o status da entrega.
          </p>
          <button
            onClick={handleReset}
            className="w-full bg-stone-800 text-white font-bold py-6 rounded-3xl flex items-center justify-center gap-3 shadow-xl hover:bg-stone-700 transition-all hover:scale-[1.02] active:scale-95 group"
          >
            <RotateCcw size={20} className="group-hover:rotate-180 transition-transform duration-500" />
            Fazer Novo Pedido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* STORE CLOSED OVERLAY */}
      {!storeSettings.isOpen && !isSettingsLoading && viewMode !== 'admin-login' && viewMode !== 'admin-dashboard' && (
        <div className="fixed inset-0 z-[100] bg-[#fcfaf7] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
          <div className="w-24 h-24 bg-stone-200 rounded-full flex items-center justify-center mb-8 shadow-inner">
            <Clock size={48} className="text-stone-500" />
          </div>
          <h1 className="text-4xl font-serif font-bold text-stone-800 mb-2">Chalé Pizzaria</h1>
          <div className="w-16 h-1 bg-rose-600 rounded-full mb-8"></div>

          <h2 className="text-2xl font-serif text-stone-700 max-w-2xl leading-relaxed">
            {storeSettings.closedMessage}
          </h2>

          <div className="mt-12 text-stone-400 text-xs font-bold uppercase tracking-[0.2em] flex flex-col gap-4">
            <span>Horário de Funcionamento</span>
            <div className="flex items-center justify-center gap-2">
              <Store size={14} />
              <span>{storeSettings.businessHours}</span>
            </div>
          </div>

          <button
            onClick={() => setViewMode('admin-login')}
            className="absolute bottom-6 right-6 text-stone-300 hover:text-stone-400 p-2 transition-colors"
          >
            <Lock size={12} />
          </button>
        </div>
      )}

      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-stone-200 py-4 no-print">
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-rose-600 p-2 rounded-xl">
              <Pizza className="text-white w-6 h-6" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-stone-800"><span className="text-rose-600">Chalé</span> Pizzaria</h1>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-green-50 px-3 py-1 rounded-full border border-green-100">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] font-bold uppercase text-green-700">Fazendo Pedidos</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8 no-print">

        {/* Progress Tracker */}
        <div className="flex justify-center items-center mb-10 gap-4 sm:gap-8 px-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all ${step === s ? 'bg-rose-600 text-white shadow-lg ring-4 ring-rose-100 scale-110' : s < step ? 'bg-green-500 text-white' : 'bg-stone-300 text-stone-600 shadow-sm'}`}>
                {s < step ? <CheckCircle2 size={18} /> : s}
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-widest ${step === s ? 'text-rose-600 font-extrabold' : 'text-stone-500 font-semibold'}`}>
                {s === 1 ? "Pizzas" : s === 2 ? "Bebidas" : s === 3 ? "Dados" : "Resumo"}
              </span>
            </div>
          ))}
        </div>

        {/* JANELA PRINCIPAL */}
        <div className="bg-white/90 backdrop-blur-sm border border-stone-100 rounded-[2.5rem] shadow-xl shadow-stone-200/50 p-6 md:p-12 transition-all">

          {/* PASSO 1: PERSONALIZAR TUDO DA PIZZA */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-3xl font-serif font-bold text-stone-800">Suas Pizzas</h2>
                  <p className="text-stone-600 text-sm font-medium">Monte cada pizza individualmente.</p>
                </div>

              </div>

              <div className="space-y-6">
                {order.pizzas.map((p, idx) => {
                  const sizeMissing = triedToAdvance && !p.size;
                  const flavorsMissing = triedToAdvance && (p.type === 'whole' ? !p.whole : (!p.half1 || !p.half2));

                  return (
                    <div key={p.id} className={`p-6 md:p-8 rounded-[2rem] border-2 transition-all bg-stone-50/20 ${sizeMissing || flavorsMissing ? 'border-red-400 ring-4 ring-red-50' : 'border-stone-200 shadow-sm'}`}>
                      <div className="flex justify-between items-center mb-8 pb-4 border-b border-stone-200">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-sm">0{idx + 1}</span>
                          <h3 className="font-bold text-stone-800 uppercase tracking-widest text-xs">Configurar Pizza</h3>
                        </div>
                        {order.pizzas.length > 1 && (
                          <button onClick={() => removePizza(p.id)} className="text-stone-400 hover:text-red-500 transition-colors"><Trash2 size={20} /></button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        {/* Tamanho e Borda */}
                        <div className="space-y-8">
                          <div>
                            <div className="flex justify-between items-end mb-4">
                              <label className={`text-[10px] font-bold uppercase tracking-[0.2em] block ${sizeMissing ? 'text-red-500' : 'text-stone-600'}`}>1. Escolha o Tamanho *</label>
                              {sizeMissing && <span className="text-[9px] text-red-500 font-bold uppercase animate-pulse">Obrigatório</span>}
                            </div>
                            <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 rounded-2xl transition-all ${sizeMissing ? 'bg-red-50' : ''}`}>
                              {SIZE_OPTIONS.map(opt => (
                                <button
                                  key={opt.size}
                                  onClick={() => updatePizza(p.id, { size: opt.size, sizePrice: opt.price, bordaPrice: p.bordaType === 'recheada' ? BORDA_PRICES[opt.size] : 0 })}
                                  className={`py-2 px-1 h-auto min-h-[60px] rounded-xl border-2 font-bold transition-all text-xs flex flex-col items-center justify-center gap-1 ${p.size === opt.size ? 'border-rose-600 bg-rose-50 text-rose-600 shadow-sm' : 'border-stone-300 bg-white text-stone-700 hover:border-rose-400'}`}
                                >
                                  <span className="text-sm">{opt.size}</span>
                                  <span className="text-[10px] text-green-600 font-extrabold bg-green-50/50 px-1.5 py-0.5 rounded-md">
                                    R$ {opt.price.toFixed(2).replace('.', ',')}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600 block mb-4">2. Borda Recheada?</label>
                            <div className="flex gap-2">
                              <button
                                onClick={() => updatePizza(p.id, { bordaType: 'normal', bordaPrice: 0 })}
                                className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all text-xs ${p.bordaType === 'normal' ? 'border-stone-800 bg-stone-800 text-white shadow-md' : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500'}`}
                              >
                                Não
                              </button>
                              <button
                                disabled={!p.size}
                                onClick={() => updatePizza(p.id, { bordaType: 'recheada', bordaPrice: p.size ? BORDA_PRICES[p.size] : 0 })}
                                className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all text-xs ${p.bordaType === 'recheada' ? 'border-rose-600 bg-rose-600 text-white shadow-lg shadow-rose-100' : 'border-stone-300 bg-stone-100 text-stone-500 disabled:opacity-30'}`}
                              >
                                Sim {p.size && `(+R$${BORDA_PRICES[p.size].toFixed(2).replace('.', ',')})`}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Sabores */}
                        <div className="space-y-6">
                          <div>
                            <div className="flex justify-between items-center mb-4">
                              <div className="flex flex-col gap-1">
                                <label className={`text-[10px] font-bold uppercase tracking-[0.2em] ${flavorsMissing ? 'text-red-500' : 'text-stone-600'}`}>3. Sabor(es) *</label>
                                {flavorsMissing && <span className="text-[9px] text-red-500 font-bold uppercase animate-pulse">Selecione o sabor</span>}
                              </div>
                              <div className="bg-stone-100 p-1 rounded-lg flex gap-1 shadow-sm border border-stone-300">
                                <button onClick={() => updatePizza(p.id, { type: 'whole' })} className={`px-4 py-1 rounded-md text-[10px] font-bold transition-all ${p.type === 'whole' ? 'bg-stone-800 text-white shadow-sm' : 'text-stone-600 hover:text-stone-900 font-bold'}`}>Inteira</button>
                                <button onClick={() => updatePizza(p.id, { type: 'half' })} className={`px-4 py-1 rounded-md text-[10px] font-bold transition-all ${p.type === 'half' ? 'bg-stone-800 text-white shadow-sm' : 'text-stone-600 hover:text-stone-900 font-bold'}`}>Meia</button>
                              </div>
                            </div>

                            {!p.size ? (
                              <div className="bg-white border-2 border-dashed border-stone-300 rounded-2xl py-12 text-center text-stone-500 text-[10px] font-bold uppercase tracking-widest">Selecione o tamanho primeiro</div>
                            ) : p.type === 'whole' ? (
                              <button
                                onClick={() => setModalConfig({ isOpen: true, pizzaId: p.id, type: 'whole', halfNum: null })}
                                className={`w-full p-6 rounded-2xl border-2 border-dashed transition-all text-center group ${p.whole ? 'border-rose-300 bg-white' : flavorsMissing ? 'border-red-400 bg-red-50 shadow-inner ring-4 ring-red-100' : 'border-stone-400 bg-white hover:border-rose-500 shadow-sm'}`}
                              >
                                {p.whole ? (
                                  <div className="animate-in zoom-in duration-300">
                                    <span className="font-bold text-rose-600 block">{p.whole.name}</span>
                                    <span className="text-[10px] text-stone-600 font-semibold">{p.whole.ingredients}</span>
                                  </div>
                                ) : (
                                  <div className={`flex flex-col items-center gap-1 group-hover:text-rose-700 ${flavorsMissing ? 'text-red-500' : 'text-stone-600'}`}>
                                    <Plus size={24} />
                                    <span className="text-[10px] font-bold uppercase">Escolher Sabor</span>
                                  </div>
                                )}
                              </button>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button onClick={() => setModalConfig({ isOpen: true, pizzaId: p.id, type: 'half', halfNum: 1 })} className={`p-4 rounded-2xl border-2 border-dashed transition-all text-center bg-white ${p.half1 ? 'border-rose-400 shadow-sm' : flavorsMissing ? 'border-red-400 bg-red-50 shadow-inner text-red-500' : 'border-stone-400 hover:border-rose-500 text-stone-600 hover:text-rose-700 font-bold'}`}>
                                  {p.half1 ? <span className="font-bold text-rose-600 text-xs">{p.half1.name}</span> : <span className="text-[10px] font-bold uppercase">+ Metade 1</span>}
                                </button>
                                <button onClick={() => setModalConfig({ isOpen: true, pizzaId: p.id, type: 'half', halfNum: 2 })} className={`p-4 rounded-2xl border-2 border-dashed transition-all text-center bg-white ${p.half2 ? 'border-rose-400 shadow-sm' : flavorsMissing ? 'border-red-400 bg-red-50 shadow-inner text-red-500' : 'border-stone-400 hover:border-rose-500 text-stone-600 hover:text-rose-700 font-bold'}`}>
                                  {p.half2 ? <span className="font-bold text-rose-600 text-xs">{p.half2.name}</span> : <span className="text-[10px] font-bold uppercase">+ Metade 2</span>}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-center mt-6">
                <button
                  onClick={addPizza}
                  className="bg-stone-800 text-white px-6 py-3 rounded-2xl text-xs font-bold hover:bg-stone-700 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
                >
                  <Plus size={18} /> Adicionar Outra Pizza
                </button>
              </div>

              {/* MODAL DE SABORES */}
              {modalConfig.isOpen && (
                <div className="fixed inset-0 z-[60] bg-stone-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
                  <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
                    <div className="p-6 border-b border-stone-100 flex justify-between items-center">
                      <div>
                        <h3 className="text-xl font-bold text-stone-800 font-serif">Escolha o Sabor</h3>
                        <p className="text-stone-500 text-xs font-bold uppercase tracking-widest">
                          {modalConfig.type === 'whole' ? 'Pizza Inteira' : `Metade ${modalConfig.halfNum}`}
                        </p>
                      </div>
                      <button onClick={() => setModalConfig({ ...modalConfig, isOpen: false })} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                        <X size={24} className="text-stone-400" />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                      {menuLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-stone-400 gap-3">
                          <Loader2 className="animate-spin text-rose-500" size={32} />
                          <span className="font-bold text-sm">Carregando sabores...</span>
                        </div>
                      ) : flavorsList.length === 0 ? (
                        <div className="text-center py-12 text-stone-400 font-bold text-sm">
                          Nenhum sabor disponível no momento.
                        </div>
                      ) : (
                        flavorsList.map((flavor) => (
                          <button
                            key={flavor.id}
                            onClick={() => {
                              updatePizza(modalConfig.pizzaId, {
                                [modalConfig.type === 'whole' ? 'whole' : modalConfig.halfNum === 1 ? 'half1' : 'half2']: flavor
                              });
                              setModalConfig({ ...modalConfig, isOpen: false });
                            }}
                            className="w-full text-left p-4 rounded-xl hover:bg-rose-50 border border-stone-100 hover:border-rose-200 transition-all group"
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-stone-700 group-hover:text-rose-700">{flavor.name}</span>
                              <ChevronRight size={16} className="text-stone-300 group-hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all" />
                            </div>
                            <p className="text-xs text-stone-500 leading-relaxed font-medium">{flavor.ingredients}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PASSO 2: BEBIDAS */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-serif font-bold text-stone-800">Bebidas</h2>
                <p className="text-stone-600 text-sm font-medium">Deseja acompanhar sua pizza com algo?</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
                {menuLoading ? (
                  <div className="col-span-3 flex flex-col items-center justify-center py-12 text-stone-400 gap-3">
                    <Loader2 className="animate-spin text-rose-500" size={32} />
                    <span className="font-bold text-sm">Carregando bebidas...</span>
                  </div>
                ) : beveragesList.length === 0 ? (
                  <div className="col-span-3 text-center py-12 text-stone-400 font-bold text-sm">
                    Nenhuma bebida disponível no momento.
                  </div>
                ) : (
                  beveragesList.map(r => {
                    const quantity = order.refrigerantes.filter(item => item.name === r.name).length;

                    return (
                      <div
                        key={r.id}
                        className={`flex flex-col items-center p-6 rounded-3xl border-2 transition-all ${quantity > 0 ? 'border-rose-600 bg-rose-50 shadow-lg' : 'border-stone-200 bg-white text-stone-700 shadow-sm'}`}
                      >
                        <span className="font-bold text-stone-800 mb-1">{r.name}</span>
                        <span className="text-rose-600 font-bold text-sm mb-6">R$ {parseFloat(r.price).toFixed(2)}</span>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setOrder(prev => {
                              const index = prev.refrigerantes.findIndex(item => item.name === r.name);
                              if (index === -1) return prev;
                              const newRefri = [...prev.refrigerantes];
                              newRefri.splice(index, 1);
                              return { ...prev, refrigerantes: newRefri };
                            })}
                            disabled={quantity === 0}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all ${quantity > 0 ? 'border-stone-300 bg-white text-stone-800 hover:bg-stone-100 hover:border-stone-400' : 'border-stone-100 bg-stone-50 text-stone-300 cursor-not-allowed'}`}
                          >
                            <Minus size={16} />
                          </button>

                          <div className="w-8 text-center font-bold text-lg text-stone-800">
                            {quantity}
                          </div>

                          <button
                            onClick={() => setOrder(prev => ({
                              ...prev,
                              refrigerantes: [...prev.refrigerantes, { name: r.name, price: parseFloat(r.price) }]
                            }))}
                            className="w-10 h-10 rounded-xl bg-stone-800 text-white flex items-center justify-center hover:bg-stone-700 active:scale-95 transition-all shadow-lg shadow-stone-200"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* PASSO 3: DADOS */}
          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-serif font-bold text-stone-800">Dados do Pedido</h2>
                <p className="text-stone-600 text-sm font-medium">Quase lá! Só precisamos saber para onde enviar.</p>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <label className={`text-[10px] font-bold uppercase tracking-widest block ${triedToAdvance && !order.customerInfo.name.trim() ? 'text-red-500' : 'text-stone-600'}`}>Seu Nome *</label>
                    {triedToAdvance && !order.customerInfo.name.trim() && <span className="text-[9px] text-red-500 font-bold uppercase animate-pulse">Campo obrigatório</span>}
                  </div>
                  <input
                    type="text"
                    value={order.customerInfo.name}
                    onChange={e => setOrder({ ...order, customerInfo: { ...order.customerInfo, name: e.target.value } })}
                    className={`w-full bg-white border rounded-2xl px-6 py-4 outline-none font-medium transition-all text-stone-800 shadow-sm ${triedToAdvance && !order.customerInfo.name.trim() ? 'border-red-400 ring-4 ring-red-50' : 'border-stone-300 focus:ring-4 focus:ring-rose-500/10'}`}
                    placeholder="Como devemos te chamar?"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setOrder({ ...order, customerInfo: { ...order.customerInfo, orderType: 'retirada' } })} className={`relative py-4 rounded-2xl border-2 font-bold text-xs flex flex-col items-center justify-center gap-2 transition-all ${order.customerInfo.orderType === 'retirada' ? 'border-stone-800 bg-stone-800 text-white shadow-xl shadow-stone-200' : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500 shadow-sm'}`}>
                    <div className="flex items-center gap-2">
                      <ShoppingBag size={18} /> Vou Retirar
                    </div>
                    {(() => {
                      let potentialDiscount = 0;
                      order.pizzas.forEach(p => {
                        if (p.size && p.size !== 'P') potentialDiscount += 5;
                      });
                      if (potentialDiscount > 0) {
                        return (
                          <span className="bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full text-[10px] animate-pulse">
                            Economize R$ {potentialDiscount.toFixed(2).replace('.', ',')}
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </button>
                  <button onClick={() => setOrder({ ...order, customerInfo: { ...order.customerInfo, orderType: 'entrega' } })} className={`py-4 rounded-2xl border-2 font-bold text-xs flex items-center justify-center gap-2 transition-all ${order.customerInfo.orderType === 'entrega' ? 'border-rose-600 bg-rose-600 text-white shadow-xl shadow-rose-200' : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500 shadow-sm'}`}>
                    <MapPin size={18} /> Entrega (+ R$ 5,00)
                  </button>
                </div>

                {order.customerInfo.orderType === 'entrega' && (
                  <div className="animate-in slide-in-from-top-2 space-y-4">
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start gap-3">
                      <Info className="text-amber-600 shrink-0 mt-0.5" size={18} />
                      <p className="text-[11px] font-semibold text-amber-900 leading-relaxed">
                        Checar disponibilidade para entregas no <span className="font-bold">Santa Quitéria</span> e <span className="font-bold">Nova Esmeraldas</span>.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <label className={`text-[10px] font-bold uppercase tracking-widest block ${triedToAdvance && !order.customerInfo.rua.trim() ? 'text-red-500' : 'text-stone-600'}`}>Rua *</label>
                          {triedToAdvance && !order.customerInfo.rua.trim() && <span className="text-[9px] text-red-500 font-bold uppercase animate-pulse">Obrigatório</span>}
                        </div>
                        <input
                          type="text"
                          value={order.customerInfo.rua}
                          onChange={e => setOrder({ ...order, customerInfo: { ...order.customerInfo, rua: e.target.value } })}
                          className={`w-full bg-white border rounded-2xl px-6 py-4 outline-none font-medium transition-all text-stone-800 shadow-sm ${triedToAdvance && !order.customerInfo.rua.trim() ? 'border-red-400 ring-4 ring-red-50' : 'border-stone-300 focus:ring-4 focus:ring-rose-500/10'}`}
                          placeholder="Ex: Rua das Flores"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1">
                          <div className="flex justify-between mb-2">
                            <label className={`text-[10px] font-bold uppercase tracking-widest block ${triedToAdvance && !order.customerInfo.numero.trim() ? 'text-red-500' : 'text-stone-600'}`}>Nº *</label>
                            {triedToAdvance && !order.customerInfo.numero.trim() && <span className="text-[9px] text-red-500 font-bold uppercase animate-pulse">Obrigatório</span>}
                          </div>
                          <input
                            type="text"
                            value={order.customerInfo.numero}
                            onChange={e => setOrder({ ...order, customerInfo: { ...order.customerInfo, numero: e.target.value } })}
                            className={`w-full bg-white border rounded-2xl px-4 py-4 outline-none font-medium transition-all text-stone-800 shadow-sm ${triedToAdvance && !order.customerInfo.numero.trim() ? 'border-red-400 ring-4 ring-red-50' : 'border-stone-300 focus:ring-4 focus:ring-rose-500/10'}`}
                            placeholder="Ex: 123"
                          />
                        </div>
                        <div className="col-span-2">
                          <div className="flex justify-between mb-2">
                            <label className={`text-[10px] font-bold uppercase tracking-widest block ${triedToAdvance && !order.customerInfo.bairro.trim() ? 'text-red-500' : 'text-stone-600'}`}>Bairro *</label>
                            {triedToAdvance && !order.customerInfo.bairro.trim() && <span className="text-[9px] text-red-500 font-bold uppercase animate-pulse">Obrigatório</span>}
                          </div>
                          <select
                            value={order.customerInfo.bairro}
                            onChange={e => {
                              const selectedBairro = e.target.value;
                              const fee = selectedBairro === 'Centro' ? 0 : 5;
                              setDeliveryFee(selectedBairro ? fee : 0);
                              setOrder({ ...order, customerInfo: { ...order.customerInfo, bairro: selectedBairro } });
                            }}
                            className={`w-full bg-white border rounded-2xl px-6 py-4 outline-none font-medium transition-all text-stone-800 shadow-sm appearance-none ${triedToAdvance && !order.customerInfo.bairro.trim() ? 'border-red-400 ring-4 ring-red-50' : 'border-stone-300 focus:ring-4 focus:ring-rose-500/10'}`}
                          >
                            <option value="">Selecione o Bairro...</option>
                            <option value="Centro">Centro (Grátis)</option>
                            <option value="Castelo Branco">Castelo Branco (+R$ 5,00)</option>
                            <option value="Fernão Dias">Fernão Dias (+R$ 5,00)</option>
                            <option value="Santa Quitéria">Santa Quitéria (+R$ 5,00)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-stone-600 block mb-2">Referência (Opcional)</label>
                        <input
                          type="text"
                          value={order.customerInfo.reference}
                          onChange={e => setOrder({ ...order, customerInfo: { ...order.customerInfo, reference: e.target.value } })}
                          className="w-full bg-white border border-stone-300 focus:ring-4 focus:ring-rose-500/10 rounded-2xl px-6 py-4 outline-none font-medium transition-all text-stone-800 shadow-sm"
                          placeholder="Próximo ao mercado..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {['cartao', 'pix', 'dinheiro'].map(m => (
                    <button key={m} onClick={() => setOrder({ ...order, customerInfo: { ...order.customerInfo, paymentMethod: m as any } })} className={`py-3 rounded-xl border-2 font-bold capitalize text-xs transition-all ${order.customerInfo.paymentMethod === m ? 'border-stone-800 bg-stone-800 text-white shadow-md' : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500 shadow-sm'}`}>
                      {m}
                    </button>
                  ))}
                </div>

                {order.customerInfo.paymentMethod === 'pix' && (
                  <div className="animate-in slide-in-from-top-2 bg-stone-100 p-4 rounded-2xl border border-stone-200 mt-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Chave Pix</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white px-4 py-3 rounded-xl border border-stone-200 font-mono text-sm font-bold text-stone-700 tracking-wider">
                        10383767695
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText('10383767695');
                          setPixCopied(true);
                          setTimeout(() => setPixCopied(false), 2000);
                        }}
                        className={`px-4 py-3 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${pixCopied ? 'bg-green-500 text-white' : 'bg-stone-800 text-white hover:bg-stone-700'}`}
                      >
                        {pixCopied ? (
                          <>
                            <CheckCircle2 size={16} /> Copiado!
                          </>
                        ) : (
                          <>
                            <ReceiptText size={16} /> Copiar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {order.customerInfo.paymentMethod === 'dinheiro' && (
                  <div className="animate-in slide-in-from-top-2">
                    <div className="flex justify-between mb-2">
                      <label className={`text-[10px] font-bold uppercase tracking-widest block ${triedToAdvance && !order.customerInfo.changeFor.trim() ? 'text-red-500' : 'text-stone-600'}`}>Troco para quanto? *</label>
                      {triedToAdvance && !order.customerInfo.changeFor.trim() && <span className="text-[9px] text-red-500 font-bold uppercase animate-pulse">Campo obrigatório</span>}
                    </div>
                    <input
                      type="text"
                      value={order.customerInfo.changeFor}
                      onChange={e => setOrder({ ...order, customerInfo: { ...order.customerInfo, changeFor: e.target.value } })}
                      className={`w-full bg-white border rounded-2xl px-6 py-4 outline-none font-medium transition-all text-stone-800 shadow-sm ${triedToAdvance && !order.customerInfo.changeFor.trim() ? 'border-red-400 ring-4 ring-red-50' : 'border-stone-300 focus:ring-4 focus:ring-rose-500/10'}`}
                      placeholder="Ex: R$ 100,00 ou 'Sem troco'"
                    />
                  </div>
                )}

                <textarea
                  value={order.customerInfo.observations}
                  onChange={e => setOrder({ ...order, customerInfo: { ...order.customerInfo, observations: e.target.value } })}
                  placeholder="Alguma observação adicional? (Ex: Retirar cebola, ponto da massa...)"
                  className="w-full bg-white border border-stone-300 rounded-2xl px-6 py-4 outline-none font-medium min-h-[120px] resize-none text-stone-800 shadow-sm focus:ring-4 focus:ring-rose-500/10"
                ></textarea>
              </div>
            </div>
          )}

          {/* PASSO 4: RESUMO */}
          {step === 4 && (
            <div className="animate-in fade-in zoom-in duration-500 max-w-2xl mx-auto">
              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ReceiptText size={32} />
                </div>
                <h2 className="text-3xl font-serif font-bold text-stone-800">Resumo do Pedido</h2>
              </div>

              <div className="bg-stone-50 rounded-[2.5rem] p-8 border border-stone-200 space-y-6 shadow-inner">
                <div className="flex justify-between items-center border-b border-stone-200 pb-4">
                  <span className="text-stone-600 font-bold uppercase text-[10px] tracking-widest">ÍTENS</span>
                  <span className="text-rose-600 font-bold text-xs uppercase tracking-widest">Preço</span>
                </div>

                <div className="space-y-4">
                  {order.pizzas.map((p, i) => (
                    <div key={i} className="flex justify-between gap-4 border-b border-stone-100 pb-2">
                      <div className="flex-1">
                        <p className="font-bold text-stone-800 text-sm">Pizza {i + 1} ({p.size})</p>
                        <p className="text-[10px] text-stone-600 font-bold uppercase tracking-wide">
                          {p.type === 'whole' ? p.whole?.name : `${p.half1?.name} / ${p.half2?.name}`}
                          {p.bordaType === 'recheada' && ' • Borda Recheada'}
                        </p>
                      </div>
                      <span className="font-bold text-stone-800 text-sm">R$ {(p.sizePrice + p.bordaPrice).toFixed(2)}</span>
                    </div>
                  ))}

                  {order.refrigerantes.map((r, i) => (
                    <div key={i} className="flex justify-between text-xs font-bold text-stone-600">
                      <span>{r.name}</span>
                      <span>R$ {r.price.toFixed(2)}</span>
                    </div>
                  ))}

                  {order.customerInfo.orderType === 'entrega' && (
                    <div className="flex justify-between text-xs font-bold text-rose-600 italic">
                      <span>Taxa de Entrega</span>
                      <span>R$ {deliveryFee.toFixed(2)}</span>
                    </div>
                  )}

                  {withdrawalDiscount > 0 && (
                    <div className="flex justify-between text-xs font-bold text-green-600 italic">
                      <span>Desconto Retirada</span>
                      <span>- R$ {withdrawalDiscount.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t-2 border-dashed border-stone-300">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold text-stone-800">Total a Pagar</span>
                    <span className="text-3xl font-serif font-bold text-rose-600">R$ {order.total.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* NAVEGAÇÃO ENTRE PASSOS */}
          <div className="mt-12 flex flex-col sm:flex-row gap-3 pt-8 border-t border-stone-200">
            {step > 1 && (
              <button onClick={handleBackStep} className="flex-1 py-5 rounded-2xl bg-stone-200 text-stone-700 font-bold hover:bg-stone-300 transition-all flex items-center justify-center gap-2 shadow-sm">
                <ChevronLeft size={20} /> Voltar
              </button>
            )}
            {step < 4 ? (
              <button onClick={handleNextStep} className="flex-[2] py-5 rounded-2xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-rose-200 group">
                Próximo Passo <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <button onClick={() => setWhatsappModalOpen(true)} className="flex-[2] py-5 rounded-2xl bg-green-600 text-white font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-green-200">
                <Phone size={20} /> Finalizar no WhatsApp
              </button>
            )}
          </div>
        </div>
      </main>



      {/* MODAL WHATSAPP */}
      {whatsappModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-md animate-in fade-in duration-300 no-print">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 text-center shadow-2xl border-2 border-stone-100">
            <div className="mb-6 inline-flex p-5 bg-green-50 text-green-600 rounded-full animate-bounce">
              <Phone size={48} />
            </div>
            <h3 className="text-2xl font-serif font-bold text-stone-800 mb-2">Quase Pronto!</h3>
            <p className="text-stone-600 text-sm mb-10 leading-relaxed font-semibold">Seu pedido foi formatado com sucesso. Clique abaixo para enviar agora no nosso WhatsApp.</p>
            <div className="space-y-3">
              <a
                href={generateWhatsAppMessage()}
                target="_blank"
                className="w-full flex items-center justify-center gap-3 py-5 px-6 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition-all shadow-xl shadow-green-100"
                onClick={() => {
                  saveOrderLocally();
                  setWhatsappModalOpen(false);
                  setIsFinished(true);
                }}
              >
                Abrir WhatsApp
              </a>
              <button onClick={() => setWhatsappModalOpen(false)} className="w-full py-4 text-stone-500 font-bold hover:text-stone-700 transition-colors text-[10px] uppercase tracking-widest border-t border-stone-100 mt-2">Voltar e Revisar</button>
            </div>
          </div>
        </div>
      )}

      <footer className="py-12 text-center text-stone-400 text-[10px] font-bold uppercase tracking-[0.4em] no-print">
        <p className="mb-4">&copy; Pizzaria Chalé &bull; Pedido Online</p>
        <button
          onClick={() => {
            if (adminUser) {
              setViewMode('admin-dashboard');
            } else {
              setViewMode('admin-login');
            }
          }}
          className="bg-stone-100 px-4 py-2 rounded-full border border-stone-200 text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-2 mx-auto"
        >
          <Settings size={12} /> Painel Administrativo
        </button>
      </footer>
    </div>
  );
}
