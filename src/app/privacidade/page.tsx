import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { site, whatsapp } from "@/lib/config";

export const metadata: Metadata = {
  title: "Política de privacidade | Fora da Caixa",
  description:
    "Quais dados o Fora da Caixa coleta no site, para que usa, com quem compartilha e como pedir acesso ou exclusão.",
};

/**
 * Política de privacidade (LGPD). É também a URL que o app da Meta exige para
 * sair do modo de desenvolvimento, e a seção #exclusao serve de "instruções de
 * exclusão de dados" no mesmo cadastro. Mudou o que o site coleta, muda aqui e
 * a data de atualização.
 */
const ATUALIZADA = "3 de novembro de 2026";

const secoes: { titulo: string; id?: string; itens: string[] }[] = [
  {
    titulo: "Quais dados coletamos",
    itens: [
      "Formulários de contato e media kit (/parcerias e páginas de parceiros): nome, empresa, segmento, WhatsApp e a mensagem que você escrever.",
      "Agendamento de convidados: nome, contato e as informações que você enviar para a gravação.",
      "Links rastreados e QR codes de parceiros: data e hora do acesso, de onde veio o clique e o tipo de navegador. Não guardamos seu nome nem seu contato nesse registro.",
      "Área de parceiros, revendedores e clientes: e-mail de login e, no aceite de termos, data, IP e navegador, como registro do aceite.",
      "Loja: o pagamento é processado pelo Mercado Pago. Não recebemos nem guardamos dados de cartão.",
    ],
  },
  {
    titulo: "Para que usamos",
    itens: [
      "Responder o seu contato e enviar propostas que você pediu.",
      "Organizar gravações e publicar o episódio do qual você participou.",
      "Medir quantas pessoas chegaram pelo QR ou link de um parceiro e mostrar esse número no relatório dele.",
      "Divulgar o próprio Fora da Caixa em redes sociais e anúncios (Meta e Google). Essas integrações usam apenas as contas do Fora da Caixa e não coletam dados de quem vê os anúncios além do que as próprias plataformas informam de forma agregada.",
    ],
  },
  {
    titulo: "Com quem compartilhamos",
    itens: [
      "Não vendemos nem alugamos seus dados.",
      "Usamos fornecedores que guardam ou processam dados em nosso nome: Supabase (banco de dados e login), Vercel (hospedagem), Resend (e-mails do sistema), Google (YouTube, Agenda e IA para análise de vídeos do canal), Meta (Facebook e Instagram) e Mercado Pago (pagamentos).",
      "Um parceiro vê o total de acessos e contatos gerados pela página dele. Quando você pede contato a um parceiro, ele recebe os dados que você preencheu para isso.",
    ],
  },
  {
    titulo: "Por quanto tempo guardamos",
    itens: [
      "Contatos e leads: enquanto houver conversa comercial e por até 2 anos depois do último contato.",
      "Registros de acesso de links e QR: até 2 anos, para os relatórios dos parceiros.",
      "Registros de aceite de termos: pelo tempo do contrato e pelo prazo legal depois dele.",
    ],
  },
  {
    titulo: "Seus direitos e exclusão de dados",
    id: "exclusao",
    itens: [
      "Pela LGPD, você pode pedir para ver, corrigir ou apagar seus dados, e revogar um consentimento que tenha dado.",
      "Para pedir a exclusão, mande uma mensagem no WhatsApp do Fora da Caixa com o seu nome e o contato que você usou (WhatsApp ou e-mail). Respondemos em até 15 dias e confirmamos quando os dados forem apagados.",
      "Se você entrou com Facebook ou Instagram em algum recurso nosso, também pode remover o acesso do app nas configurações da sua conta, em Apps e sites. Depois disso, peça a exclusão pelo WhatsApp para apagarmos o que já foi guardado.",
    ],
  },
];

export default function PrivacidadePage() {
  return (
    <main className="bg-dark-900 text-white overflow-x-hidden">
      <Navbar />

      <section className="pt-32 pb-16 lg:pt-40 lg:pb-24 bg-[#0a0a0a]">
        <div className="container-px max-w-3xl mx-auto flex flex-col gap-10">
          <header className="flex flex-col gap-4">
            <span className="section-tag">Privacidade</span>
            <h1 className="text-4xl sm:text-5xl font-black leading-[1.05] tracking-tight">
              Política de privacidade
            </h1>
            <p className="text-white/65 leading-relaxed">
              O {site.brand} ({site.location}) é o responsável pelos dados coletados em{" "}
              <span className="text-white/85">pfctv.com.br</span>. Aqui está o que coletamos, por que
              e como você pede para apagar.
            </p>
            <p className="text-white/40 text-sm">Atualizada em {ATUALIZADA}.</p>
          </header>

          {secoes.map((s) => (
            <section key={s.titulo} id={s.id} className="flex flex-col gap-4 scroll-mt-28">
              <h2 className="text-2xl font-bold">{s.titulo}</h2>
              <ul className="flex flex-col gap-3 text-white/70 leading-relaxed list-disc pl-5">
                {s.itens.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </section>
          ))}

          <a
            href={whatsapp("Olá! Quero pedir acesso ou exclusão dos meus dados no Fora da Caixa.")}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary self-start px-8 py-4 rounded-xl text-base"
          >
            Pedir pelo WhatsApp
          </a>
        </div>
      </section>

      <Footer />
    </main>
  );
}
