<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Recupera tu contraseña</title>
</head>
<body style="margin:0;padding:24px;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
    <h1 style="font-size:20px;margin:0 0 12px;">Recupera tu contraseña</h1>
    <p style="font-size:14px;line-height:1.5;margin:0 0 16px;">Hola {{ $name }},</p>
    <p style="font-size:14px;line-height:1.5;margin:0 0 20px;">
      Recibimos una solicitud para cambiar la contraseña de tu cuenta en {{ $siteName }}.
      El enlace vence en 1 hora.
    </p>
    <p style="margin:0 0 24px;">
      <a href="{{ $resetUrl }}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;">Cambiar mi contraseña</a>
    </p>
    <p style="font-size:12px;line-height:1.5;color:#6b7280;margin:0;">
      Si no fuiste tú, ignora este correo: tu contraseña no cambia.
    </p>
  </div>
</body>
</html>
