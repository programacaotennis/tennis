# Programacao Tenis

Primeira versao do app de agendamento de quadras, com interface responsiva em HTML, CSS e JavaScript. O arquivo `index.html` e o ponto de entrada para hospedagem estatica.

## Rodar localmente

1. Instale o PHP 8.1 ou superior e adicione o executavel ao `PATH` se quiser usar o servidor local.
2. Na raiz do projeto, execute:

```powershell
php -S localhost:8080
```

3. Abra `http://localhost:8080/index.html`.

O app usa o Supabase para autenticação, quadras e reservas. O administrador precisa ter o papel `admin` na tabela `profiles`.

Para publicar sem PHP, use `index.html` em Cloudflare Pages, Netlify ou GitHub Pages.

## Supabase

1. Crie um projeto no Supabase.
2. Execute o arquivo `supabase.sql` no SQL Editor.
3. Ative Email/Password e Google em **Authentication > Providers**.
4. Promova o primeiro usuario a administrador usando o `update` comentado no final do SQL.
5. Se o banco já existia, execute também `supabase-migration-horarios.sql` para aplicar a grade diária de 06:00 a 22:00 em blocos de 2 horas.
6. Execute `supabase-migration-recorrencia.sql` para habilitar reservas diária, semanal e mensal e o limite de 30 dias consecutivos.
7. Execute `supabase-migration-calendario-publico.sql` para permitir que todos os membros consultem o calendário de reservas confirmadas.

Ao atualizar uma instalação existente, execute novamente `supabase-migration-recorrencia.sql`: ela adiciona os dados de contexto das notificações e valida a disponibilidade semanal também no banco.

## Alertas push

O projeto inclui Web Push para avisar os membros quando uma reserva é cancelada. Para ativar em produção:

1. Gere um par de chaves VAPID, por exemplo com `npx web-push generate-vapid-keys --json`.
2. Copie a chave pública para `pushVapidPublicKey` em `assets/app.js`.
3. No Supabase, configure os segredos `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` (por exemplo, `mailto:contato@seudominio.com`).
4. Publique a função: `supabase functions deploy send-booking-push`.
5. Execute novamente `supabase-migration-recorrencia.sql` no SQL Editor.

Após entrar no app, cada membro pode clicar em **Ativar alertas neste dispositivo** no painel de notificações e autorizar o navegador. O push depende dessa permissão e de HTTPS.

O administrador inicial usa o login `progtenis` e o e-mail `programacaotennis@gmail.com`. Ao cadastrar essa conta pelo formulário, ela recebe automaticamente o papel `admin`; a senha deve ser definida no cadastro. O painel permite alterar e-mail e senha depois. A criação de usuário não pode ser feita por SQL sem expor a chave administrativa do Supabase.

## Escopo da primeira entrega

- Login, cadastro manual e ponto de entrada para Google.
- Perfil de membro e perfil administrador.
- Selecao de quadra, data e horario.
- Confirmação de reserva persistida no Supabase, com bloqueio de horário ocupado.
- Painel administrativo com quadras, disponibilidade e administradores.
- Esquema inicial com RLS para `profiles`, `courts`, `availability` e `bookings`.
