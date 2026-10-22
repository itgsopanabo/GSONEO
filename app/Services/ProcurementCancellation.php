<?php

namespace App\Services;

use App\LogsAudit;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequest;
use Illuminate\Support\Facades\DB;

/**
 * Cancelling a purchase request or a purchase order.
 *
 * Cancellation is an administrative act, not a step in the workflow: it takes a
 * record out of the pipeline and keeps it, with who did it, when, and why. The
 * record is never deleted — the PR and PO numbers stay spent, which is the point.
 *
 * There are two shapes of it, because a cancelled order does not always mean a
 * cancelled request:
 *
 *   cancelRequest()  the whole thing is void — the request and its order.
 *   cancelOrder()    only the order is void (a supplier backed out, a wrong PO).
 *                    The request returns to canvassing so a new PO can be issued.
 *
 * Both rules live here rather than in the controllers, so the screen, the route
 * and the audit trail cannot drift apart on what is allowed.
 */
class ProcurementCancellation
{
    use LogsAudit;

    public const CANCELLED = 800;

    /** Completed, declined and already-cancelled records are left alone. */
    private const TERMINAL = [600, 700, self::CANCELLED];

    /** From here on the goods exist: inspection, RIS, SSMI, outgoing. */
    private const GOODS_RECEIVED_FROM = 300;

    // -----------------------------------------------------------------
    // What is allowed
    // -----------------------------------------------------------------

    /** Why this request cannot be cancelled, or null when it can be. */
    public function requestRefusal(PurchaseRequest $pr): ?string
    {
        return match (true) {
            (int) $pr->status === self::CANCELLED => 'This purchase request is already cancelled.',
            (int) $pr->status === 600 => 'This purchase request is completed and can no longer be cancelled.',
            (int) $pr->status === 700 => 'This purchase request was already declined.',
            default => null,
        };
    }

    /**
     * Why only this order cannot be cancelled, or null when it can be.
     *
     * Two limits, both deliberate:
     *
     * - Once the delivery has been inspected there is no canvassing stage to
     *   return to, so from there the whole request is the only thing to cancel.
     * - Once a PO number has been issued the order cannot be cancelled on its own.
     *   `purchase_order.PR_Number` is unique, so a request holds exactly one order
     *   row: letting it go back for another PO would either reuse the issued number
     *   or free it for a different order, and an issued number must stay spent.
     *   Lifting this means allowing many orders per request — a schema change that
     *   also touches the monitoring, dashboard and report joins.
     */
    public function orderRefusal(?PurchaseOrder $po): ?string
    {
        if (! $po) {
            return 'This request has no purchase order yet.';
        }

        $pr = $po->purchaseRequest;

        return match (true) {
            in_array((int) $po->status, self::TERMINAL, true) => 'This purchase order can no longer be cancelled.',
            (bool) $po->PO_Number
                => "Purchase order {$po->PO_Number} has already been issued a number. Cancel the whole request instead.",
            $pr && (int) $pr->status >= self::GOODS_RECEIVED_FROM && (int) $pr->status !== self::CANCELLED
                => 'The delivery has already been received. Cancel the whole request instead.',
            default => null,
        };
    }

    // -----------------------------------------------------------------
    // Doing it
    // -----------------------------------------------------------------

    /** Cancel a request and, if it has one, its purchase order. */
    public function cancelRequest(PurchaseRequest $pr, string $reason): void
    {
        DB::transaction(function () use ($pr, $reason) {
            $po = $pr->purchaseOrder()->first();

            $before = $pr->only(['status', 'cancelled_by_emp_id', 'cancelled_at', 'cancellation_reason']);
            $pr->update($this->cancellation($reason));

            $this->audit(
                'cancelled',
                $pr,
                "Cancelled Purchase Request #{$pr->pr_number}: {$reason}",
                $before,
                $pr->only(['status', 'cancelled_by_emp_id', 'cancelled_at', 'cancellation_reason']),
            );

            if ($po && ! in_array((int) $po->status, self::TERMINAL, true)) {
                $poBefore = $po->only(['status', 'cancelled_by_emp_id', 'cancelled_at', 'cancellation_reason']);
                $po->update($this->cancellation($reason));

                $this->audit(
                    'cancelled',
                    $po,
                    "Cancelled Purchase Order {$this->orderLabel($po)} with Purchase Request #{$pr->pr_number}: {$reason}",
                    $poBefore,
                    $po->only(['status', 'cancelled_by_emp_id', 'cancelled_at', 'cancellation_reason']),
                );
            }
        });
    }

    /**
     * Cancel only the order; the request goes back to canvassing.
     *
     * It returns to Printed Canvas when canvas forms were already produced, and
     * to Verified otherwise — the two points the Purchase Order screen picks a
     * request up from, so it reappears there ready for a new PO.
     */
    public function cancelOrder(PurchaseOrder $po, string $reason): void
    {
        DB::transaction(function () use ($po, $reason) {
            $pr = $po->purchaseRequest;

            $before = $po->only(['status', 'cancelled_by_emp_id', 'cancelled_at', 'cancellation_reason']);
            $po->update($this->cancellation($reason));

            $returnedTo = null;

            if ($pr) {
                $returnedTo = $pr->canvasForms()->exists() ? 205 : 100;
                $prBefore = $pr->only(['status']);
                $pr->update(['status' => $returnedTo]);

                $this->audit(
                    'returned_to_canvassing',
                    $pr,
                    "Purchase Request #{$pr->pr_number} returned to canvassing after its purchase order was cancelled.",
                    $prBefore,
                    ['status' => $returnedTo],
                );
            }

            $this->audit(
                'cancelled',
                $po,
                "Cancelled Purchase Order {$this->orderLabel($po)}: {$reason}",
                $before,
                $po->only(['status', 'cancelled_by_emp_id', 'cancelled_at', 'cancellation_reason']),
            );
        });
    }

    /** @return array<string, mixed> */
    private function cancellation(string $reason): array
    {
        return [
            'status' => self::CANCELLED,
            'cancelled_by_emp_id' => auth()->id(),
            'cancelled_at' => now(),
            'cancellation_reason' => $reason,
        ];
    }

    /** An unnumbered order has only its request to identify it. */
    private function orderLabel(PurchaseOrder $po): string
    {
        return $po->PO_Number ? "#{$po->PO_Number}" : "for #{$po->PR_Number}";
    }
}
