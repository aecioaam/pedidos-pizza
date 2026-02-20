
export interface PizzaSabor {
  name: string;
  ingredients: string;
}

export interface PizzaInOrder {
  id: string;
  type: 'whole' | 'half';
  whole: PizzaSabor | null;
  half1: PizzaSabor | null;
  half2: PizzaSabor | null;
  size: string | null;
  sizePrice: number;
  bordaType: 'normal' | 'recheada';
  bordaPrice: number;
}

export interface BordaInfo {
  type: 'normal' | 'recheada';
  price: number;
}

export interface Refrigerante {
  name: string;
  price: number;
}

export interface CustomerInfo {
  name: string;
  orderType: 'retirada' | 'entrega';
  rua: string;
  numero: string;
  bairro: string;
  address: string;
  reference: string;
  paymentMethod: 'cartao' | 'dinheiro' | 'pix';
  changeFor: string;
  observations: string;
}

export interface OrderState {
  pizzas: PizzaInOrder[];
  refrigerantes: Refrigerante[];
  customerInfo: CustomerInfo;
  total: number;
}

export interface Order extends OrderState {
  id: string;
  status: 'pending' | 'completed';
  createdAt: number;
}
