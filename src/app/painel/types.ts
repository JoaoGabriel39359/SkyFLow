export type ResellerDevice = {
  mac_address: string;
  iptv_user: string;
  iptv_url?: string;
  iptv_pass?: string;
  expires_at: string;
};

export type ResellerTab = 'home' | 'ativar' | 'clientes' | 'subrevendedores' | 'pagamento';
