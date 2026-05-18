<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #1f2937;">
    <h2>Gracias por tu compra</h2>
    <p>Hola {{ $invoice['customerName'] }},</p>
    <p>
        Adjuntamos la factura <strong>{{ $invoice['orderNumber'] }}</strong> por un total de
        <strong>${{ number_format($invoice['total'], 0, ',', '.') }}</strong>.
    </p>
    <p>Método de pago: {{ $invoice['paymentMethod'] }}</p>
    <p style="color: #6b7280; font-size: 12px;">Atendido por {{ $invoice['sellerName'] }}.</p>
</body>
</html>
