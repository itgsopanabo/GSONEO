<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;

/**
 * @method static create(array $array)
 * @property mixed $role
 * @property mixed $status
 */
class User extends Authenticatable
{

    protected $with = ['role', 'status'];

    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'password',
        'emp_id',
        'role_id',
        'status_id',
        'emp_fname',
        'emp_lname',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'temporary_password_expires_at' => 'datetime',
        ];
    }

    /** No look-alikes (0/O, 1/l/I), so a password read aloud or copied by hand survives. */
    private const TEMPORARY_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

    /**
     * Replace this account's password with a random one-time password, save,
     * and return it so an admin can hand it over once. It works until the user
     * chooses their own (RequirePasswordChange) or the hours in
     * config Users.temporary_password_hours pass. A new remember token stops an
     * old "keep me signed in" cookie from bringing the previous login back.
     */
    public function issueTemporaryPassword(): string
    {
        $alphabet = self::TEMPORARY_PASSWORD_ALPHABET;
        $password = '';

        for ($i = 0; $i < 12; $i++) {
            $password .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        $this->forceFill([
            'password' => $password,
            'remember_token' => Str::random(60),
            'temporary_password_expires_at' => now()->addHours(config('Users.temporary_password_hours')),
        ])->save();

        return $password;
    }

    /** Still on a one-time password from an admin, which must be replaced. */
    public function hasTemporaryPassword(): bool
    {
        return $this->temporary_password_expires_at !== null;
    }

    public function temporaryPasswordExpired(): bool
    {
        return $this->hasTemporaryPassword() && $this->temporary_password_expires_at->isPast();
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    public function status(): BelongsTo
    {
        return $this->belongsTo(Status::class, 'status_id');
    }

    /**
     * Check if the user has a specific role.
     *
     * Careful: role_name is not unique — "Section Head" exists in four
     * sections. Compare role_id when the distinction matters.
     */
    public function hasRole(string $roleName): bool
    {
        return $this->role && $this->role->role_name === $roleName;
    }

    /** Permission names granted through this user's role. */
    public function permissionNames(): array
    {
        return $this->role?->permissionNames() ?? [];
    }

    public function hasPermission(string $permission): bool
    {
        return in_array($permission, $this->permissionNames(), true);
    }

    public function hasAnyPermission(array $permissions): bool
    {
        return count(array_intersect($permissions, $this->permissionNames())) > 0;
    }

    public function isAdmin(): bool
    {
        return $this->role_id === config('Users.sys_admin_role_id');
    }

    public function isActive(): bool
    {
        return (int) $this->status?->status_code === config('Users.active_status_code');
    }

    /**
     * Get the name of the unique identifier for the user.
     *
     * @return string
     */
    public function getAuthIdentifierName(): string
    {
        return 'emp_id';
    }
}
