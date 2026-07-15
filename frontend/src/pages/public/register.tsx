import { Helmet } from 'react-helmet-async';

import EmployeeRegisterView from 'src/sections/app/employee-register/register-view';

export default function RegisterPage() {
  return (
    <>
      <Helmet>
        <title>Decor Center — Регистрация сотрудника</title>
      </Helmet>
      <EmployeeRegisterView />
    </>
  );
}
