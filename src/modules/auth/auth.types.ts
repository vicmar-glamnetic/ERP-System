export interface LoginBody {
  employee_code: string;
  password: string;
}

export interface RefreshBody {
  refresh_token: string;
}
