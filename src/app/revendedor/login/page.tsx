import LoginForm from "@/components/auth/LoginForm";

export default function ResellerLogin() {
  return (
    <LoginForm
      subtitle="Área do revendedor"
      home="/revendedor"
      note="O acesso é criado pela equipe do Fora da Caixa. Se o link de recuperação não chegar, chame no WhatsApp."
    />
  );
}
