<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\PurchaseOrder;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class SSMIController extends Controller
{
    /** RIS issued: the SSMI is numbered here, then the order is sent to Outgoing. */
    private const STATUS_FOR_SSMI = 500;

    /** Stages an order is at once its SSMI has gone to Outgoing. */
    private const PAST_SSMI = [550, 600];

    /** What the page shows for each order. */
    private const WITH = ['purchaseRequest.items', 'iars.items', 'openTags.tag', 'openTags.taggedBy', 'ssmiNumberedBy', 'receivedBy'];

    /**
     * The SSMI screen, in two tabs.
     *
     *   pending  orders at the SSMI stage, both steps: waiting for a number, and
     *            numbered but not yet sent to Outgoing
     *   issued   every SSMI sent on to Outgoing, newest first, so the document
     *            can still be found and reprinted
     *
     * `order` selects one order in the detail panel, and is also sent on its own
     * as `focusOrder` so a link to an order on a later page still opens it.
     */
    public function index(Request $request)
    {
        $filters = $request->validate([
            'view' => ['nullable', 'in:pending,issued'],
            'search' => ['nullable', 'string', 'max:100'],
            'order' => ['nullable', 'integer'],
        ]);
        $view = $filters['view'] ?? 'pending';
        $search = trim($filters['search'] ?? '');

        $purchaseOrders = PurchaseOrder::with(self::WITH)
            ->when(
                $view === 'issued',
                fn ($q) => $q->whereIn('status', self::PAST_SSMI)->whereNotNull('SSMI_Number')
                    ->orderByDesc('SSMI_Date')->orderByDesc('id'),
                // Numbered ones first: they only need sending on.
                fn ($q) => $q->where('status', self::STATUS_FOR_SSMI)
                    ->orderByRaw('SSMI_Number IS NULL')
                    ->orderBy('RIS_Date')
                    ->orderBy('id'),
            )
            ->when($search !== '', fn ($q) => $q->where(fn ($q) => $q
                ->where('PO_Number', 'like', "%{$search}%")
                ->orWhere('PR_Number', 'like', "%{$search}%")
                ->orWhere('PO_Supplier', 'like', "%{$search}%")
                ->orWhere('RIS_Number', 'like', "%{$search}%")
                ->orWhere('SSMI_Number', 'like', "%{$search}%")
                ->orWhereHas('purchaseRequest', fn ($pr) => $pr->where('requester_department', 'like', "%{$search}%"))))
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Inventory/SSMI/Index', [
            'purchaseOrders' => $purchaseOrders,
            'focusOrder' => isset($filters['order']) ? PurchaseOrder::with(self::WITH)->find($filters['order']) : null,
            'filters' => ['view' => $view, 'search' => $search, 'order' => $filters['order'] ?? null],
            'counts' => [
                'pending' => PurchaseOrder::where('status', self::STATUS_FOR_SSMI)->count(),
                'issued' => PurchaseOrder::whereIn('status', self::PAST_SSMI)->whereNotNull('SSMI_Number')->count(),
            ],
            'fundSources' => config('documents.fund_sources'),
        ]);
    }

    public function generateNumber(Request $request, PurchaseOrder $purchaseOrder)
    {
        $validated = $request->validate([
            'fund_source' => ['required', Rule::in(array_keys(config('documents.fund_sources')))],
        ], [
            'fund_source.required' => 'Choose the source of fund the supplies are charged to.',
        ]);

        if ($purchaseOrder->SSMI_Number) {
            return redirect()
                ->route('ssmi.index', ['order' => $purchaseOrder->id])
                ->with('error', "PO #{$purchaseOrder->PO_Number} already has {$purchaseOrder->SSMI_Number}.");
        }

        if ((int) $purchaseOrder->status !== self::STATUS_FOR_SSMI) {
            return back()->with('error', "PO #{$purchaseOrder->PO_Number} is not in the SSMI stage.");
        }

        if ($blocker = $purchaseOrder->missingBlocker()) {
            return back()->with('error', $blocker);
        }

        $oldValues = $purchaseOrder->only(['SSMI_Number', 'fund_source']);

        $ssmiNumber = DB::transaction(function () use ($purchaseOrder, $validated) {
            $year = now()->year;

            $lastSSMI = PurchaseOrder::where('SSMI_Number', 'like', "SSMI-{$year}-%")
                ->lockForUpdate()
                ->orderByRaw("CAST(SUBSTRING(SSMI_Number, -4) AS UNSIGNED) DESC")
                ->first();

            $nextSeq = $lastSSMI ? ((int) substr($lastSSMI->SSMI_Number, -4)) + 1 : 1;

            do {
                $candidate = sprintf('SSMI-%d-%04d', $year, $nextSeq);
                $exists = PurchaseOrder::where('SSMI_Number', $candidate)->exists();
                $nextSeq++;
            } while ($exists);

            // Saved inside the transaction, so the lock above still covers it and
            // two people numbering at once cannot be handed the same number.
            $purchaseOrder->update([
                'SSMI_Number' => $candidate,
                'SSMI_Date' => now(),
                'ssmiNumbered_by' => auth()->id(),
                'fund_source' => $validated['fund_source'],
            ]);

            return $candidate;
        });

        AuditLog::create([
            'user_id' => auth()->id(),
            'action' => 'Generate SSMI Number',
            'auditable_type' => get_class($purchaseOrder),
            'auditable_id' => $purchaseOrder->id,
            'description' => "Generated SSMI number {$ssmiNumber} for Purchase Order #{$purchaseOrder->id}, charged to {$purchaseOrder->fund_source}",
            'old_values' => $oldValues,
            'new_values' => $purchaseOrder->only(['SSMI_Number', 'fund_source']),
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);

        // Stay on the order: sending it to Outgoing is the next step.
        return redirect()
            ->route('ssmi.index', ['order' => $purchaseOrder->id])
            ->with('success', "{$ssmiNumber} generated for PO #{$purchaseOrder->PO_Number}. Send it to Outgoing when the document is ready.");
    }

    public function toOutgoing(PurchaseOrder $purchaseOrder)
    {
        if ((int) $purchaseOrder->status !== self::STATUS_FOR_SSMI) {
            return back()->with('error', 'This order is not in the SSMI stage.');
        }

        if (! $purchaseOrder->SSMI_Number) {
            return back()->with('error', 'Generate an SSMI number before moving this order to outgoing.');
        }

        if ($blocker = $purchaseOrder->missingBlocker()) {
            return back()->with('error', $blocker);
        }

        $oldValues = $purchaseOrder->only(['status']);

        $purchaseOrder->update(['status' => 550]);

        AuditLog::create([
            'user_id'        => auth()->id(),
            'action'         => 'Proceed to Outgoing',
            'auditable_type' => $purchaseOrder->getMorphClass(),
            'auditable_id'   => $purchaseOrder->id,
            'description'    => "Moved PO #{$purchaseOrder->id} ({$purchaseOrder->SSMI_Number}) to outgoing",
            'old_values'     => $oldValues,
            'new_values'     => $purchaseOrder->only(['status']),
            'ip_address'     => request()->ip(),
            'user_agent'     => request()->userAgent(),
        ]);

        return redirect()
            ->route('ssmi.index', ['view' => 'issued', 'order' => $purchaseOrder->id])
            ->with('success', "PO #{$purchaseOrder->PO_Number} sent to Outgoing with {$purchaseOrder->SSMI_Number}.");
    }

    public function document(PurchaseOrder $purchaseOrder)
    {
        abort_unless($purchaseOrder->SSMI_Number, 404, 'No SSMI number has been generated for this order.');

        $purchaseOrder->load(['purchaseRequest.items', 'iars.items']);
        $purchaseRequest = $purchaseOrder->purchaseRequest;

        $items = $this->issuedLines($purchaseOrder);

        // The SSMI covers the issue slip it summarises: from the month the RIS
        // was issued to the month of the SSMI itself.
        $from = $purchaseOrder->RIS_Date ? Carbon::parse($purchaseOrder->RIS_Date) : null;
        $to = Carbon::parse($purchaseOrder->SSMI_Date ?? now());

        $pdf = Pdf::loadView('pdf.ssmi', [
            'purchaseOrder' => $purchaseOrder,
            'purchaseRequest' => $purchaseRequest,
            'iars' => $purchaseOrder->iars,
            'items' => $items,
            'grandTotal' => $items->sum('total_cost'),
            'periodFrom' => ($from ?? $to)->format('F'),
            'periodTo' => $to->format('F'),
            'periodYear' => $to->format('Y'),
            'officeCode' => collect([$this->departmentCode($purchaseRequest?->requester_department), $purchaseOrder->fund_source])
                ->filter()
                ->join('-'),
            'procurementMode' => $purchaseRequest?->mode_of_procurement,
            'sourceOfFund' => $purchaseOrder->fund_source,
        ]);

        $pdf->setOptions(['defaultFont' => 'DejaVu Sans']);

        return $pdf->stream("{$purchaseOrder->SSMI_Number}.pdf");
    }

    /**
     * The lines actually issued, with the quantity and cost the form prints.
     *
     * The quantity is what the IARs received, not what the request asked for —
     * they differ when an administrator accepted a short delivery. A line that
     * received nothing was not issued and is left off. Orders inspected before
     * IARs recorded quantities fall back to the ordered quantity.
     *
     * The unit cost is the awarded (bidding) cost where one was recorded, the
     * estimate otherwise.
     */
    private function issuedLines(PurchaseOrder $purchaseOrder): Collection
    {
        $lines = $purchaseOrder->purchaseRequest?->items ?? collect();
        $received = $purchaseOrder->iars->flatMap->items->isNotEmpty()
            ? $purchaseOrder->receivedQuantities()
            : null;

        return $lines
            ->map(function ($line) use ($received) {
                $issued = clone $line;
                $issued->quantity_issued = $received === null ? (int) $line->quantity : ($received[$line->id] ?? 0);
                $issued->unit_cost = (float) ($line->bidding_unit_cost ?? $line->estimated_unit_cost ?? 0);
                $issued->total_cost = $issued->quantity_issued * $issued->unit_cost;

                return $issued;
            })
            ->filter(fn ($line) => $line->quantity_issued > 0)
            ->values();
    }

    /**
     * The requesting office's code, e.g. "CAGRO" for City Agriculture Office.
     *
     * Requests store the department by name, so it is matched the same way the
     * monitoring filter does. An office missing from the departments table
     * prints its name instead.
     */
    private function departmentCode(?string $department): ?string
    {
        if (! filled($department)) {
            return null;
        }

        return DB::table('departments')
            ->whereRaw('LOWER(TRIM(Department_Name)) = ?', [mb_strtolower(trim($department))])
            ->value('Department_Code') ?? trim($department);
    }
}
