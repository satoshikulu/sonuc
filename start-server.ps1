# Yerel sunucu - PDF carousel icin gerekli
$port = 8080
$dir  = $PSScriptRoot

function Start-PowerShellServer {
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$port/")
    $listener.Start()
    Write-Host "Sunucu: http://localhost:$port" -ForegroundColor Green
    Write-Host "Durdurmak icin Ctrl+C" -ForegroundColor Gray
    Start-Process "http://localhost:$port"

    $mime = @{
        '.html' = 'text/html; charset=utf-8'
        '.css'  = 'text/css; charset=utf-8'
        '.js'   = 'application/javascript; charset=utf-8'
        '.pdf'  = 'application/pdf'
        '.png'  = 'image/png'
        '.ico'  = 'image/x-icon'
    }

    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $path = $ctx.Request.Url.LocalPath.TrimStart('/')
        if ($path -eq '') { $path = 'index.html' }
        $file = Join-Path $dir ($path -replace '/', '\')

        if (Test-Path $file -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($file).ToLower()
            $ctx.Response.ContentType = $mime[$ext]
            if (-not $ctx.Response.ContentType) { $ctx.Response.ContentType = 'application/octet-stream' }
            $bytes = [System.IO.File]::ReadAllBytes($file)
            $ctx.Response.ContentLength64 = $bytes.Length
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $ctx.Response.StatusCode = 404
            $msg = [Text.Encoding]::UTF8.GetBytes('404 Not Found')
            $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
        }
        $ctx.Response.Close()
    }
}

foreach ($cmd in @('python','py','python3')) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        Set-Location $dir
        Write-Host "Python ile baslatiliyor..." -ForegroundColor Cyan
        & $cmd -m http.server $port 2>$null
        if ($LASTEXITCODE -eq 0) { exit }
    }
}

Write-Host "PowerShell sunucusu kullaniliyor..." -ForegroundColor Cyan
try {
    Start-PowerShellServer
} catch {
    Write-Host "Sunucu baslatilamadi: $_" -ForegroundColor Red
}
