@echo off
REM ============================================================================
REM  ARREGLAR BACKEND (Supabase) - ejecutar como ADMINISTRADOR
REM  Clic derecho sobre este archivo -> "Ejecutar como administrador"
REM
REM  Problema: Windows ha reservado el rango dinamico 54244-54343, que incluye
REM  54321/54322/54323 (Kong/Postgres/Studio). Docker no puede publicar esos
REM  puertos y el backend no responde (login caido).
REM
REM  Este script refresca esa reserva (winnat) y reinicia el motor de Docker.
REM ============================================================================
echo.
echo === [1/3] Refrescando reserva dinamica de puertos (winnat) ===
net stop winnat
net start winnat
echo.
echo === [2/3] Reiniciando motor de Docker ===
taskkill /f /im "Docker Desktop.exe" >nul 2>&1
net stop com.docker.service >nul 2>&1
net start com.docker.service
if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
echo.
echo === [3/3] Rangos excluidos AHORA (deben NO incluir 54321-54323) ===
netsh interface ipv4 show excludedportrange protocol=tcp
echo.
echo ============================================================
echo  LISTO. Espera a que Docker Desktop termine de arrancar
echo  (icono verde) y AVISA para que arranque Supabase:
echo      npx supabase start
echo ============================================================
pause
