# MUHAMMEDASLANPDF.pdf degistiginde pdf-data.js dosyasini gunceller (yerel file:// icin)
$pdf = Join-Path $PSScriptRoot 'MUHAMMEDASLANPDF.pdf'
$out = Join-Path $PSScriptRoot 'pdf-data.js'
if (-not (Test-Path $pdf)) { Write-Error "PDF bulunamadi: $pdf"; exit 1 }
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($pdf))
Set-Content -Path $out -Value "window.PDF_BASE64='$b64';" -Encoding UTF8
Write-Host "pdf-data.js guncellendi." -ForegroundColor Green
