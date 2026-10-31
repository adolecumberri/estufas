@echo off
REM ============================================================================
REM  REAPUNTAR EL PUENTE 8450 -> API de Supabase (puerto nuevo 55321)
REM  Ejecutar como ADMINISTRADOR (clic derecho -> Ejecutar como administrador)
REM
REM  Motivo: Windows reserva 54321-54324 (rangos excluidos dinamicos), asi que
REM  Supabase local ahora usa 55321 (API), 55322 (Postgres), 55323 (Studio),
REM  55324 (Inbucket). El movil/Tailscale usa el puente 8450: hay que
REM  reapuntarlo al puerto nuevo y permitir la franja en el firewall.
REM ============================================================================
echo.
echo === [1/3] Borrando puente anterior 8450 -^> 54321 ===
netsh interface portproxy delete v4tov4 listenport=8450 listenaddress=0.0.0.0
echo.
echo === [2/3] Creando puente 8450 -^> 127.0.0.1:55321 ===
netsh interface portproxy add v4tov4 listenport=8450 listenaddress=0.0.0.0 connectport=55321 connectaddress=127.0.0.1
echo.
echo === [3/3] Firewall: permitir 55321-55324 (todos los perfiles) ===
netsh advfirewall firewall add rule name="estufas-supabase-55321-55324" dir=in action=allow protocol=TCP localport=55321-55324 profile=any
echo.
echo === Estado final del puente ===
netsh interface portproxy show all
echo.
echo ============================================================
echo  LISTO. Prueba en el movil: la app sigue usando
echo  http://100.64.220.67:8450 (no hay que cambiar nada).
echo ============================================================
pause
