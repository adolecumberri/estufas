@echo off
REM ============================================================================
REM Permite que el movil alcance el servidor de Expo (puerto 8081) y que
REM node.exe reciba conexiones entrantes. Ejecutar como administrador:
REM   clic derecho -> "Ejecutar como administrador"
REM ============================================================================
echo.
echo === Permitiendo Expo (puerto 8081) y node.exe ===
echo.

echo [1/4] Eliminando posibles reglas de bloqueo de node.exe...
netsh advfirewall firewall delete rule name=all dir=in program="C:\Program Files\nodejs\node.exe" >nul 2>&1
netsh advfirewall firewall delete rule name=all dir=in program="C:\Program Files\nodejs\node.exe" >nul 2>&1

echo [2/4] Permitiendo el programa node.exe (todos los perfiles)...
netsh advfirewall firewall add rule name="estufas-node-in" dir=in action=allow program="C:\Program Files\nodejs\node.exe" profile=any enable=yes

echo [3/4] Permitiendo el puerto TCP 8081...
netsh advfirewall firewall add rule name="estufas-expo-8081" dir=in action=allow protocol=TCP localport=8081 profile=any

echo [4/4] Reglas que quedan para node.exe / 8081:
netsh advfirewall firewall show rule name=all dir=in | findstr /i "node 8081"

echo.
echo ============================================================
echo  LISTO. Cierra esta ventana y prueba en el movil:
echo.
echo     exp://100.64.220.67:8081     (Tailscale encendido)
echo     exp://192.168.1.129:8081     (misma WiFi)
echo ============================================================
pause
