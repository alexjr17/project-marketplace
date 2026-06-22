<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\MercadoPagoService;
use App\Services\Messaging\Channels\MessengerChannel;
use App\Services\Messaging\Channels\WhatsAppChannel;
use App\Services\WompiService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class WebhookController extends Controller
{
    use ApiResponse;

    public function __construct(
        private WompiService $wompi,
        private MercadoPagoService $mercadoPago,
        private MessengerChannel $messenger,
        private WhatsAppChannel $whatsapp,
    ) {}

    /** Handshake del webhook de Meta — Meta hace GET ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=... */
    public function messengerVerify(Request $request)
    {
        $challenge = $this->messenger->verifyWebhook(
            $request->query('hub_mode'),
            $request->query('hub_verify_token'),
            $request->query('hub_challenge'),
        );

        if ($challenge === null) {
            return response('Forbidden', 403);
        }

        // Meta exige que se devuelva el challenge como texto plano.
        return response($challenge, 200)->header('Content-Type', 'text/plain');
    }

    /** Webhook entrante de Messenger / Instagram (mismo endpoint, Meta los enruta por "object"). */
    public function messengerIncoming(Request $request)
    {
        try {
            $raw = $request->getContent();
            $signature = $request->header('X-Hub-Signature-256');

            if (! $this->messenger->verifySignature($raw, $signature)) {
                Log::warning('[Messenger] Firma inválida en webhook entrante');

                return response('Invalid signature', 401);
            }

            $payload = $request->all();
            $result = $this->messenger->handleInbound($payload);

            // Meta espera 200 siempre — si devolvemos otro código, reintentará.
            return response()->json(['ok' => true] + $result);
        } catch (Throwable $e) {
            Log::error('[Messenger] Webhook entrante: '.$e->getMessage());

            return response()->json(['ok' => false, 'error' => $e->getMessage()]);
        }
    }

    /** Handshake de Meta para WhatsApp Cloud API (mismo formato que Messenger). */
    public function whatsappVerify(Request $request)
    {
        $challenge = $this->whatsapp->verifyWebhook(
            $request->query('hub_mode'),
            $request->query('hub_verify_token'),
            $request->query('hub_challenge'),
        );

        if ($challenge === null) {
            return response('Forbidden', 403);
        }

        return response($challenge, 200)->header('Content-Type', 'text/plain');
    }

    /** Webhook entrante de WhatsApp Cloud API. */
    public function whatsappIncoming(Request $request)
    {
        try {
            $raw = $request->getContent();
            $signature = $request->header('X-Hub-Signature-256');

            if (! $this->whatsapp->verifySignature($raw, $signature)) {
                Log::warning('[WhatsApp] Firma inválida en webhook entrante');

                return response('Invalid signature', 401);
            }

            $payload = $request->all();
            $result = $this->whatsapp->handleInbound($payload);

            return response()->json(['ok' => true] + $result);
        } catch (Throwable $e) {
            Log::error('[WhatsApp] Webhook entrante: '.$e->getMessage());

            return response()->json(['ok' => false, 'error' => $e->getMessage()]);
        }
    }

    /** Webhook de eventos de Wompi (pública, valida la firma). */
    public function wompi(Request $request)
    {
        $event = $request->all();

        try {
            if (! $this->wompi->validateWebhookSignature($event)) {
                return $this->error('Firma inválida', 401);
            }

            $result = match ($event['event'] ?? '') {
                'transaction.updated' => $this->wompi->processTransactionEvent($event),
                'nequi_token.updated' => ['success' => true, 'message' => 'Token Nequi procesado'],
                default => ['success' => true, 'message' => 'Evento recibido'],
            };

            return response()->json([
                'success' => $result['success'],
                'message' => $result['message'],
            ]);
        } catch (Throwable $e) {
            Log::error('Webhook Wompi: '.$e->getMessage());

            // Siempre 200 para que Wompi no reintente.
            return response()->json(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    /** Webhook de eventos de Mercado Pago (pública). */
    public function mercadopago(Request $request)
    {
        try {
            // MP puede notificar por body (type/data.id) o por query (topic/id).
            $payload = $request->all();
            if (empty($payload['type']) && $request->query('topic')) {
                $payload = [
                    'type' => $request->query('topic'),
                    'data' => ['id' => $request->query('id')],
                ];
            }

            $result = $this->mercadoPago->processWebhook($payload);

            // Siempre 200 para que Mercado Pago no reintente indefinidamente.
            return response()->json(['success' => $result['success'], 'message' => $result['message']]);
        } catch (Throwable $e) {
            Log::error('Webhook MercadoPago: '.$e->getMessage());

            return response()->json(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    /** Confirma un pago de Mercado Pago por consulta directa (retorno del back_url). */
    public function confirmMercadoPago(Request $request, string $orderNumber)
    {
        $paymentId = (string) ($request->query('payment_id') ?? $request->query('collection_id') ?? '');
        if ($paymentId === '') {
            return $this->error('Falta el identificador del pago', 400);
        }

        $result = $this->mercadoPago->confirmByPaymentId($paymentId, $orderNumber);

        return response()->json($result);
    }

    /** Verifica el estado de una transacción directamente con Wompi (admin). */
    public function verifyWompiTransaction(string $transactionId)
    {
        $details = $this->wompi->getTransactionDetails($transactionId);

        if (! $details) {
            return $this->error('No se pudo verificar la transacción', 404);
        }

        return $this->success([
            'transactionId' => $transactionId,
            'status' => $details['status'],
        ]);
    }
}
