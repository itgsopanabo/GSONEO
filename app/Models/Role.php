<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Cache;

/**
 * @method static select(string $string, string $string1)
 */
class Role extends Model
{
    use HasFactory;

    protected $table = 'role';

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'permission_role');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'role_id');
    }

    /** Permission names for this role, cached until the role's permissions change. */
    public function permissionNames(): array
    {
        return Cache::rememberForever(static::cacheKey($this->id), fn () => $this->permissions()->pluck('name')->all());
    }

    public static function forgetPermissionCache(int $roleId): void
    {
        Cache::forget(static::cacheKey($roleId));
    }

    private static function cacheKey(int $roleId): string
    {
        return "role:{$roleId}:permissions";
    }
}
