<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\WompiService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class WebhookController extends Controller
{
    use ApiResponse;

    public function __construct(private WompiService $wompi) {}

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
