<?php

namespace App\Services;

use App\LogsAudit;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequest;
use Illuminate\Support\Facades\DB;

/**
 * Moving a request or an order to another status (administrators only).
 *
 * This is the repair tool for records that went the wrong way — a delivery sent
 * to SSMI that belonged in Incoming, a request verified by mistake. Cancelling
 * is a separate act with its own paperwork (ProcurementCancellation); this one
 * puts a record back on the rails.
 *
 * Two things make it more than writing a number into a column.
 *
 * 1. The flow lives on two records. Up to 230 the status is the request's; from
 *    230 on it is the order's (Incoming → IAR → RIS → SSMI → Outgoing). So a
 *    target names the record it belongs to, and only statuses that record can
 *    actually hold are offered.
 *
 * 2. Going backwards has to undo the paperwork of the stages it reverses.
 *    RISController and SSMIController both refuse to issue a number when one is
 *    already there, so a record sent back to Incoming with its RIS number intact
 *    would reach the RIS stage again and stop dead. Moving below a stage
 *    therefore voids that stage's number, and the audit entry keeps what was
 *    voided. IARs are left alone: a purchase order may legitimately have several
 *    (partial deliveries), and IAR generation has no such guard.
 */
class ProcurementStatusChange
{
    use LogsAudit;

    /** Statuses the purchase request itself can hold. */
    private const REQUEST_TRACK = [0, 1, 100, 200, 205, 210, 230];

    /** Statuses the purchase order carries once the request reaches the PO stage. */
    private const ORDER_TRACK = [210, 230, 300, 400, 500, 550, 600];

    /**
     * Reached by their own actions, so never offered as a target here — but a
     * record sitting on one can be moved off it, which is how a cancellation or
     * a mistaken decline is reversed.
     */
    private const NOT_A_TARGET = [700, ProcurementCancellation::CANCELLED];

    /** Stage → the columns issued when a record reaches it. */
    private const STAGE_DOCUMENTS = [
        500 => ['label' => 'RIS', 'number' => 'RIS_Number', 'columns' => ['RIS_Number', 'RIS_Date', 'risNumbered_by']],
        550 => ['label' => 'SSMI', 'number' => 'SSMI_Number', 'columns' => ['SSMI_Number', 'SSMI_Date', 'ssmiNumbered_by']],
    ];

    /**
     * Stage → timestamps that only make sense at or above it.
     *
     * Cleared on the way down so the record does not claim to have been released
     * before it was, which would also feed a nonsense span into the stage averages.
     */
    private const STAGE_TIMESTAMPS = [
        300 => ['received_at', 'received_by_emp_id'],
        600 => ['released_at'],
    ];

    /**
     * Every status this record could be moved to, for the screen to offer.
     *
     * @return array<int, array{record: string, code: int, label: string, current: bool, blocked: ?string, voids: array<int, string>}>
     */
    public function options(PurchaseRequest $pr, ?PurchaseOrder $po, ?bool $hasIar = null): array
    {
        $labels = $this->labels();
        $options = [];

        foreach (self::REQUEST_TRACK as $code) {
            $options[] = [
                'record' => 'request',
                'code' => $code,
                'label' => $labels[$code] ?? (string) $code,
                'current' => (int) $pr->status === $code,
                'blocked' => $this->requestBlocker($code, $po),
                'voids' => [],
            ];
        }

        if ($po) {
            foreach (self::ORDER_TRACK as $code) {
                $options[] = [
                    'record' => 'order',
                    'code' => $code,
                    'label' => $labels[$code] ?? (string) $code,
                    'current' => (int) $po->status === $code,
                    'blocked' => $this->orderBlocker($code, $po, $hasIar),
                    'voids' => $this->voided($po, $code),
                ];
            }
        }

        return $options;
    }

    /** Why this request cannot be moved to that status, or null when it can. */
    public function requestBlocker(int $code, ?PurchaseOrder $po): ?string
    {
        $live = $po && ! in_array((int) $po->status, self::NOT_A_TARGET, true);

        return match (true) {
            ! in_array($code, self::REQUEST_TRACK, true) => 'A purchase request cannot hold this status.',
            // Past the PO stage the order carries the flow and the request just reads
            // "PO Generated". Moving the request then changes nothing real and makes
            // the monitoring list show a stage the record has long left.
            $live && (int) $po->status > 230 => 'The purchase order has moved past this point. Change the order\'s status instead.',
            // Below the PO stage the order would be left behind, listed nowhere and
            // blocking a new one. Cancelling the order does this properly: it voids
            // the order and returns the request to canvassing.
            $code < 210 && $live => 'This request has a purchase order. Cancel the order instead — that returns the request to canvassing.',
            $code === 210 && ! $live => 'There is no purchase order to be waiting on.',
            $code === 230 && ! $po?->PO_Number => 'No PO number has been issued yet.',
            default => null,
        };
    }

    /**
     * Why this order cannot be moved to that status, or null when it can.
     *
     * `$hasIar` lets a caller listing many orders answer the IAR question once for
     * the whole page instead of a query per row; left null, it is looked up here.
     */
    public function orderBlocker(int $code, PurchaseOrder $po, ?bool $hasIar = null): ?string
    {
        return match (true) {
            ! in_array($code, self::ORDER_TRACK, true) => 'A purchase order cannot hold this status.',
            in_array($code, [230, 300], true) && ! $po->PO_Number => 'No PO number has been issued yet.',
            $code === 400 && ! ($hasIar ?? $po->iars()->exists()) => 'No IAR has been generated for this order yet.',
            $code === 500 && ! $po->RIS_Number => 'No RIS number has been issued yet.',
            in_array($code, [550, 600], true) && ! $po->SSMI_Number => 'No SSMI number has been issued yet.',
            default => null,
        };
    }

    /**
     * The documents a move to this status would void, described for the dialog.
     *
     * @return array<int, string>
     */
    public function voided(PurchaseOrder $po, int $code): array
    {
        $voided = [];

        foreach (self::STAGE_DOCUMENTS as $stage => $document) {
            if ($code < $stage && $po->{$document['number']}) {
                $voided[] = "{$document['label']} {$po->{$document['number']}}";
            }
        }

        return $voided;
    }

    // -----------------------------------------------------------------
    // Doing it
    // -----------------------------------------------------------------

    public function moveRequest(PurchaseRequest $pr, int $code, string $reason): void
    {
        DB::transaction(function () use ($pr, $code, $reason) {
            $before = $pr->only(['status', 'cancelled_by_emp_id', 'cancelled_at', 'cancellation_reason']);
            $from = $before['status'];

            $pr->update(['status' => $code] + $this->clearedCancellation($code));

            $this->audit(
                'status_changed',
                $pr,
                "Purchase Request #{$pr->pr_number} moved from status {$from} to {$code}: {$reason}",
                $before,
                $pr->only(['status', 'cancelled_by_emp_id', 'cancelled_at', 'cancellation_reason']),
            );
        });
    }

    public function moveOrder(PurchaseOrder $po, int $code, string $reason): void
    {
        DB::transaction(function () use ($po, $code, $reason) {
            $voided = $this->voided($po, $code);

            $before = $po->only(array_merge(
                ['status', 'cancelled_by_emp_id', 'cancelled_at', 'cancellation_reason'],
                ...array_values(array_map(fn (array $d) => $d['columns'], self::STAGE_DOCUMENTS)),
            ));
            $from = $before['status'];

            $po->update(['status' => $code] + $this->clearedCancellation($code) + $this->clearedDocuments($po, $code));

            $note = $voided ? ' Voided: '.implode(', ', $voided).'.' : '';

            $this->audit(
                'status_changed',
                $po,
                "Purchase Order {$this->label($po)} moved from status {$from} to {$code}: {$reason}{$note}",
                $before,
                $po->only(array_keys($before)),
            );
        });
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    /** Leaving 800 means the record is no longer cancelled, so that trail is cleared. */
    private function clearedCancellation(int $code): array
    {
        return $code === ProcurementCancellation::CANCELLED
            ? []
            : ['cancelled_by_emp_id' => null, 'cancelled_at' => null, 'cancellation_reason' => null];
    }

    /** Numbers and timestamps for stages above the target, so they can happen again. */
    private function clearedDocuments(PurchaseOrder $po, int $code): array
    {
        $cleared = [];

        foreach (self::STAGE_DOCUMENTS as $stage => $document) {
            if ($code < $stage) {
                $cleared += array_fill_keys($document['columns'], null);
            }
        }

        foreach (self::STAGE_TIMESTAMPS as $stage => $columns) {
            if ($code < $stage) {
                $cleared += array_fill_keys($columns, null);
            }
        }

        return $cleared;
    }

    /**
     * @return array<int, string> status code => description
     *
     * Held for the life of the instance: a monitoring page asks for the options of
     * twenty rows, and the status table is the same for all of them.
     */
    private function labels(): array
    {
        return $this->labels ??= DB::table('status')->pluck('status_desc', 'status_code')->all();
    }

    /** @var array<int, string>|null */
    private ?array $labels = null;

    private function label(PurchaseOrder $po): string
    {
        return $po->PO_Number ? "#{$po->PO_Number}" : "for #{$po->PR_Number}";
    }
}
