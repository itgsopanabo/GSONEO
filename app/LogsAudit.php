<?php

namespace App;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

trait LogsAudit
{
    /**
     * Write a single audit trail entry.
     *
     * @param  string       $action       Human-readable action, e.g. 'PO Proceeding', 'Created', 'Cancelled'
     * @param  Model        $model        Any Eloquent model
     * @param  string|null  $description  Sentence describing what happened, shown in the audit UI
     * @param  array|null   $before       Attribute values prior to the change
     * @param  array|null   $after        Attribute values after the change
     * @param  array        $overrides    Escape hatch for any column you need to set by hand
     */
    protected function audit(
        string $action,
        Model $model,
        ?string $description = null,
        ?array $before = null,
        ?array $after = null,
        array $overrides = []
    ): void {
        AuditLog::create(array_merge([
            'user_id'        => Auth::id(),
            'action'         => $action,
            'auditable_type' => $model->getMorphClass(),
            'auditable_id'   => $this->resolveAuditKey($model),
            'description'    => $description,
            'old_values'     => $before,
            'new_values'     => $after,
            'ip_address'     => request()->ip(),
            'user_agent'     => request()->userAgent(),
        ], $overrides));
    }

    /**
     * Which value identifies the record in the trail.
     *
     * Defaults to the primary key. A model can opt into a business key
     * by defining getAuditKey(), e.g. on PurchaseRequest:
     *
     *     public function getAuditKey(): string
     *     {
     *         return $this->pr_number;
     *     }
     */
    protected function resolveAuditKey(Model $model): int|string|null
    {
        return method_exists($model, 'getAuditKey')
            ? $model->getAuditKey()
            : $model->getKey();
    }
}
