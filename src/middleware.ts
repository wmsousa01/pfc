import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Áreas logadas: cada uma tem a sua própria tela de login. */
const AREAS = [
  { prefix: "/admin", login: "/admin/login", home: "/admin" },
  { prefix: "/revendedor", login: "/revendedor/login", home: "/revendedor" },
];

/**
 * Atua nas rotas logadas (admin e revendedor): refresca a sessão do Supabase
 * e barra visitantes não autenticados, mandando para o login da área.
 * Segue o padrão oficial @supabase/ssr (reescreve cookies no request/response).
 *
 * Aqui só se verifica SE há sessão. QUEM é (admin ou revendedor) é decidido
 * nas páginas, via requireAdmin()/requireReseller() — o middleware roda no
 * edge a cada request e uma consulta de papel aqui sairia caro.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const area = AREAS.find(
    (a) => pathname === a.prefix || pathname.startsWith(`${a.prefix}/`)
  );
  if (!area) return response;

  const isLogin = pathname === area.login;

  // Copia os cookies (possivelmente refrescados) para uma resposta de redirect.
  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!user && !isLogin) return redirectTo(area.login);
  if (user && isLogin) return redirectTo(area.home);

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/revendedor/:path*"],
};
