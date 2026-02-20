import { PizzaSabor } from './types';

export const MENU_SABORES: PizzaSabor[] = [
  { name: "À moda Chalé", ingredients: "Mussarela, calabresa, presunto, azeitona verde, cebola e pimentão" },
  { name: "À moda Esmeraldas", ingredients: "Mussarela, salaminho, presunto, champignon, azeitona verde e manjericão" },
  { name: "Portuguesa", ingredients: "Mussarela, calabresa, presunto, bacon, ovo, azeitona preta e tomate" },
  { name: "Frango", ingredients: "Mussarela, frango desfiado e molho bolonhesa" },
  { name: "Frango Catupiry", ingredients: "Mussarela, frango desfiado e catupiry" },
  { name: "Palmito", ingredients: "Mussarela, palmito e molho bolonhesa" },
  { name: "4 Queijos", ingredients: "Mussarela, catupiry, provolone e gorgonzola" },
  { name: "Vegetariana", ingredients: "Mussarela, palmito, milho verde, azeitona verde, tomate, cebola e pimentão" },
  { name: "Lombo Canadense", ingredients: "Mussarela e lombo canadense" },
  { name: "Presunto", ingredients: "Mussarela e presunto" },
  { name: "Presunto Especial", ingredients: "Mussarela, presunto, bacon, milho verde e tomate" },
  { name: "Calabresa", ingredients: "Mussarela e calabresa" },
  { name: "Atum", ingredients: "Mussarela, atum, tomate e salsa" },
  { name: "Bacon", ingredients: "Mussarela, bacon, ovo e tomate" },
  { name: "Nordestina", ingredients: "Mussarela, carne de sol, cebola roxa e catupiry" },
  { name: "Marguerita", ingredients: "Mussarela, tomate e manjericão" },
  { name: "Banana", ingredients: "Mussarela, banana e canela" }
];

export const SIZE_OPTIONS = [
  { size: "PP", diameter: "20cm", fatias: "2 fatias", price: 35.00 },
  { size: "M", diameter: "25cm", fatias: "4 fatias", price: 65.00 },
  { size: "G", diameter: "30cm", fatias: "6 fatias", price: 75.00 },
  { size: "GG", diameter: "35cm", fatias: "8 fatias", price: 85.00 },
];

export const BORDA_PRICES: Record<string, number> = {
  "PP": 5.00,
  "M": 8.00,
  "G": 10.00,
  "GG": 15.00
};

export const REFRIGERANTES = [
  { name: "Coca-Cola 2L", price: 15.00 },
  { name: "Coca-Cola Zero 2L", price: 15.00 },
  { name: "Guaraná 2L", price: 15.00 },
];

export const DELIVERY_FEE = 5.00;
export const WHATSAPP_NUMBER = "5531992382944";

export const NOTIFICATION_SOUND = "data:audio/mp3;base64,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";