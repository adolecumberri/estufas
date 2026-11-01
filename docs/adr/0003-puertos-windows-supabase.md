# ADR 0003: Puertos del stack Supabase local en Windows

- **Estado**: aceptado (2026-11-01).
- **Contexto**: los puertos por defecto de Supabase (54322 API / 54321 DB /
  54323 Studio) chocaban con servicios ya presentes en el equipo Windows de
  desarrollo (los 5432x están excluidos), y el CLI de Docker Desktop usaba el
  pipe `npipe` en lugar de TCP.
- **Decisión**: el stack local se publica en **API 8450, Postgres 55322,
  Studio 55323** (configurado en `supabase/config.toml`). Para el CLI de
  Docker se usa `DOCKER_HOST=tcp://127.0.0.1:2375`; el CLI de Supabase usa un
  home redirigido al workspace (`USERPROFILE`/`HOME` →
  `.cli-home`, ya ignorado por git) porque el sandbox de trabajo bloquea
  escrituras fuera del workspace.
- **Consecuencias**: los puertos quedan documentados en AGENTS.md; los
  comandos de backend (migration up, gen types, test db) requieren los env
  indicados; `supabase gen types` usa `--db-url` directo a 55322 porque el
  spawn de docker está bloqueado en el sandbox de los workers.
