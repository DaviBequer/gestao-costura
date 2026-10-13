# Servidor local simples para abrir o app no computador (não precisa instalar nada).
# Uso: clique duas vezes em "Abrir-App.bat" ou rode:  powershell -ExecutionPolicy Bypass -File servidor.ps1
param([int]$Porta = 8080, [switch]$SemNavegador)

$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$tipos = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json'; '.webmanifest' = 'application/manifest+json'; '.png' = 'image/png'
  '.jpg' = 'image/jpeg'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Porta/")
try { $listener.Start() } catch { Write-Host "Não consegui usar a porta $Porta. Talvez o app já esteja aberto." -ForegroundColor Red; exit 1 }

$url = "http://localhost:$Porta/"
Write-Host ""
Write-Host "  Gestão Costura rodando em $url" -ForegroundColor Green
Write-Host "  Deixe esta janela aberta enquanto usa o app. Feche para parar."
Write-Host ""
if (-not $SemNavegador) { Start-Process $url }

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  try {
    $caminho = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($caminho -eq '') { $caminho = 'index.html' }
    $arquivo = [System.IO.Path]::GetFullPath((Join-Path $raiz $caminho))
    if (-not $arquivo.StartsWith($raiz) -or -not (Test-Path $arquivo -PathType Leaf)) {
      $res.StatusCode = 404
      $bytes = [Text.Encoding]::UTF8.GetBytes('Não encontrado')
    } else {
      $ext = [System.IO.Path]::GetExtension($arquivo).ToLower()
      $res.ContentType = if ($tipos.ContainsKey($ext)) { $tipos[$ext] } else { 'application/octet-stream' }
      $res.Headers.Add('Cache-Control', 'no-cache')
      $bytes = [System.IO.File]::ReadAllBytes($arquivo)
    }
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
    $res.StatusCode = 500
  } finally {
    $res.Close()
  }
}
