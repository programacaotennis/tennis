# Programacao Tenis

Primeira versao do app de agendamento de quadras, com interface responsiva em HTML, CSS e JavaScript. O arquivo `index.html` e o ponto de entrada para hospedagem estatica.

## Rodar localmente

1. Instale o PHP 8.1 ou superior e adicione o executavel ao `PATH` se quiser usar o servidor local.
2. Na raiz do projeto, execute:

```powershell
php -S localhost:8080
```

3. Abra `http://localhost:8080/index.html`.

O modo demo permite testar o fluxo sem backend. Para visualizar a area administrativa, use `admin@programacaotenis.com` com qualquer senha. As reservas de membro ficam no `localStorage` do navegador nesta primeira etapa.

Para publicar sem PHP, use `index.html` em Cloudflare Pages, Netlify ou GitHub Pages.

## Supabase

1. Crie um projeto no Supabase.
2. Execute o arquivo `supabase.sql` no SQL Editor.
3. Ative Email/Password e Google em **Authentication > Providers**.
4. Promova o primeiro usuario a administrador usando o `update` comentado no final do SQL.
5. Na proxima etapa, substitua o modo demo do `assets/app.js` por `supabase.auth.signInWithPassword`, `signUp`, `signInWithOAuth` e consultas nas tabelas criadas.

## Escopo da primeira entrega

- Login, cadastro manual e ponto de entrada para Google.
- Perfil de membro e perfil administrador.
- Selecao de quadra, data e horario.
- Confirmacao de reserva com persistencia local para prototipacao.
- Painel administrativo com quadras, disponibilidade e administradores.
- Esquema inicial com RLS para `profiles`, `courts`, `availability` e `bookings`.