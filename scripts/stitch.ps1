# Helper: llamadas al MCP oficial de Google Stitch desde PowerShell.
# Uso: .\scripts\stitch.ps1 -Tool list_projects
#       .\scripts\stitch.ps1 -Tool get_screen -Args '{"project_name":"projects/123","screen_name":"projects/123/screens/abc"}'
# La API key se lee de .env.local (STITCH_API_KEY=...) — nunca se commitea.
param(
    [Parameter(Mandatory = $true)][string]$Tool,
    [string]$Args = "{}",
    [string]$Method = "tools/call"
)

$ErrorActionPreference = "Stop"

$keyLine = Select-String -Path (Join-Path $PSScriptRoot "..\.env.local") -Pattern '^STITCH_API_KEY=' | Select-Object -First 1
if (-not $keyLine) { throw "No se encuentra STITCH_API_KEY en .env.local" }
$apiKey = $keyLine.Line.Substring("STITCH_API_KEY=".Length).Trim()

$arguments = $Args | ConvertFrom-Json
$payload = @{
    jsonrpc = "2.0"
    id      = [int]((Get-Date -UFormat %s) -replace '\.', '') % 2147483647
    method  = $Method
    params  = @{ name = $Tool; arguments = $arguments }
}
$body = $payload | ConvertTo-Json -Depth 24 -Compress

$response = Invoke-WebRequest -Method Post -Uri "https://stitch.googleapis.com/mcp" `
    -Headers @{
        "Content-Type"  = "application/json"
        Accept          = "application/json, text/event-stream"
        "X-Goog-Api-Key" = $apiKey
    } `
    -Body $body -UseBasicParsing -TimeoutSec 600

$contentType = [string]$response.Headers["Content-Type"]
if ($contentType -like "text/event-stream*") {
    # Respuesta SSE: un evento puede traer varias líneas `data:` (se unen con
    # salto de línea), se descartan los marcadores [DONE] y se parsea el último
    # evento JSON-RPC completo.
    $eventos = [System.Collections.Generic.List[string]]::new()
    $datas = [System.Collections.Generic.List[string]]::new()
    foreach ($linea in ($response.Content -split "`r?`n")) {
        if ($linea -like "data:*") {
            $datas.Add($linea.Substring(5).TrimStart())
        } elseif ([string]::IsNullOrWhiteSpace($linea)) {
            if ($datas.Count -gt 0) {
                $eventos.Add(($datas -join "`n"))
                $datas.Clear()
            }
        }
    }
    if ($datas.Count -gt 0) { $eventos.Add(($datas -join "`n")) }
    $ultimo = @($eventos | Where-Object { $_ -and $_ -ne "[DONE]" } | Select-Object -Last 1)
    if ($ultimo.Count -eq 0) { throw "Respuesta SSE sin payload JSON-RPC." }
    $json = $ultimo[0] | ConvertFrom-Json
} else {
    $json = $response.Content | ConvertFrom-Json
}
if ($json.error) {
    Write-Output ("ERROR: " + $json.error.message)
    exit 1
}
if ($json.result -and $json.result.isError) {
    # Llamada a herramienta fallida: el error va a stderr y se sale con código 1.
    if ($json.result.error -and $json.result.error.message) {
        $errText = $json.result.error.message
    } elseif ($json.result.content -and $json.result.content[0].text) {
        $errText = $json.result.content[0].text
    } else {
        $errText = $json.result | ConvertTo-Json -Depth 10 -Compress
    }
    Write-Error -ErrorAction Continue ("ERROR: " + $errText)
    exit 1
}
if ($json.result.structuredContent) {
    $json.result.structuredContent | ConvertTo-Json -Depth 14
} elseif ($json.result.content -and $json.result.content[0].text) {
    Write-Output $json.result.content[0].text
} else {
    $json.result | ConvertTo-Json -Depth 10
}
