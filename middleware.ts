import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;

  // Rotas públicas que não requerem proteção
  const isPublicRoute =
    pathname === "/" ||
    pathname === "/professor/login" ||
    pathname === "/aluno/login" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/public") ||
    pathname.startsWith("/seed") ||
    pathname.startsWith("/icons") ||
    pathname === "/manifest.json" ||
    pathname === "/favicon.ico";

  if (isPublicRoute) {
    return response;
  }

  // Verificar autenticação
  const { data: { user } } = await supabase.auth.getUser();

  // Proteção da área do professor e administrativa (/professor/... e /admin/...)
  if (pathname.startsWith("/professor") || pathname.startsWith("/admin")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/professor/login";
      return NextResponse.redirect(url);
    }

    const papel = user.app_metadata?.papel || user.user_metadata?.papel;
    // Se o usuário autenticado for explicitamente um estudante, impede acesso ao painel
    if (papel === "student") {
      const url = request.nextUrl.clone();
      url.pathname = "/professor/login";
      url.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(url);
    }
  }

  // Proteção da área do aluno (/aluno/...)
  if (pathname.startsWith("/aluno")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/aluno/login";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
