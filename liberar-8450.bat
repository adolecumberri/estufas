@echo off
REM ============================================================================
REM  LIBERAR EL PUERTO 8450 (borra el puente portproxy)
REM  Ejecutar como ADMINISTRADOR (clic derecho -> Ejecutar como administrador)
REM
REM  Objetivo: que el API de Supabase escuche DIRECTAMENTE en 8450, el puerto
REM  al que ya apuntan la app y el movil (http://<IP-PC>:8450). Asi no hay
REM  puente de red de por medio. Config previa: supabase/config.toml [api] port=8450
REM ============================================================================
echo.
echo === Borrando puente 8450 del portproxy (si existe) ===
netsh interface portproxy delete v4tov4 listenport=8450 listenaddress=0.0.0.0
echo.
echo === Asegurando firewall: permitir 8450 entrante (todos los perfiles) ===
netsh advfirewall firewall add rule name="estufas-api-8450" dir=in action=allow protocol=TCP localport=8450 profile=any
echo.
echo === Estado del portproxy (8450 ya no debe aparecer) ===
netsh interface portproxy show all
echo.
echo ============================================================
echo  LISTO. Avisa para arrancar Supabase con la API en 8450.
echo ============================================================
pause
