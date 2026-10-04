export interface OrderDTO {
  id: string;
  client_id?: string;
  cargo_weight?: number;
  cargo_length?: number;
  cargo_width?: number;
  cargo_height?: number;
  origin_address?: string;
  destination_address?: string;
  price?: number;
  status?: string;
  created_at?: string;
}
