export interface CreateEmployeeBody {
  employee_code: string;
  full_name: string;
  email: string;
  password: string;
  role: string;
  department?: string;
  manager_id?: string;
}

export interface UpdateEmployeeBody {
  full_name?: string;
  email?: string;
  role?: string;
  department?: string;
  manager_id?: string;
  status?: string;
}

export interface ChangePasswordBody {
  new_password: string;
  current_password?: string;
}

export interface CreateShiftBody {
  employee_id: string;
  shift_date: string;
  zone?: string;
  clock_in?: string;
  clock_out?: string;
}

export interface AttendanceBody {
  event_type: 'clock_in' | 'clock_out';
}

export interface EmployeeRow {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  role: string;
  department: string | null;
  manager_id: string | null;
  status: string;
  created_at: Date;
}
