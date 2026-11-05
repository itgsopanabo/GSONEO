<?php

use App\Models\Role;
use App\Models\Status;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\StatusSeeder;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->seed([RoleSeeder::class, StatusSeeder::class, PermissionSeeder::class]);

    // Status keeps its ids for the whole process; the rows are new in every test.
    Closure::bind(fn () => static::$activeId = static::$selectableIds = null, null, Status::class)();
});

function superadmin(): User
{
    return User::factory()->create(['role_id' => Role::where('role_name', 'Superadmin')->value('id')]);
}

test('an unknown employee ID and a wrong password get the same message', function () {
    $user = User::factory()->create();

    $this->post('/login', ['empID' => 1, 'password' => 'password'])
        ->assertSessionHasErrors(['empID' => 'The employee ID or password is incorrect.']);

    $this->post('/login', ['empID' => $user->emp_id, 'password' => 'wrong-password'])
        ->assertSessionHasErrors(['empID' => 'The employee ID or password is incorrect.']);

    $this->assertGuest();
});

test('one IP address is stopped after 20 failed sign-ins across different IDs', function () {
    $user = User::factory()->create();

    foreach (range(101, 120) as $empId) {
        $this->post('/login', ['empID' => $empId, 'password' => 'guess']);
    }

    // Even the right password for an account nobody tried yet is refused.
    $this->post('/login', ['empID' => $user->emp_id, 'password' => 'password']);

    expect(session('errors')->first('empID'))->toContain('Too many');
    $this->assertGuest();
});

test('adding a user gives them a random one-time password, shown once', function () {
    $this->actingAs(superadmin())->post(route('users.store'), [
        'emp_id' => 55555,
        'emp_fname' => 'Ana',
        'emp_lname' => 'Cruz',
        'role_id' => Role::where('role_name', 'PR Encoder')->value('id'),
        'status_id' => Status::activeId(),
    ])->assertSessionHasNoErrors();

    $issued = session('temporary_password');
    $user = User::where('emp_id', 55555)->first();

    expect($issued['password'])->toHaveLength(12)
        ->and(Hash::check($issued['password'], $user->password))->toBeTrue()
        ->and($user->hasTemporaryPassword())->toBeTrue()
        ->and($user->temporary_password_expires_at->isFuture())->toBeTrue();
});

test('issuing a new one-time password replaces the old one', function () {
    $user = User::factory()->create();

    $this->actingAs(superadmin())->put(route('users.password', $user), ['sign_out' => true])
        ->assertSessionHas('temporary_password');

    $user->refresh();

    expect(Hash::check('password', $user->password))->toBeFalse()
        ->and(Hash::check(session('temporary_password')['password'], $user->password))->toBeTrue()
        ->and($user->hasTemporaryPassword())->toBeTrue();
});

test('a user on a one-time password can only read until they choose their own', function () {
    $user = User::factory()->onTemporaryPassword()->create();

    $this->actingAs($user)->patch(route('profile.update'), [])
        ->assertSessionHas('error', 'Set up a new password before making changes.');

    // The one-time password itself is not accepted as the new one.
    $this->actingAs($user)->put(route('password.first-change'), [
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertSessionHasErrors('password');

    $this->actingAs($user)->put(route('password.first-change'), [
        'password' => 'my-own-pass-2026',
        'password_confirmation' => 'my-own-pass-2026',
    ])->assertSessionHasNoErrors();

    expect($user->fresh()->hasTemporaryPassword())->toBeFalse();
});

test('an expired one-time password no longer signs in', function () {
    $user = User::factory()->onTemporaryPassword(now()->subMinute())->create();

    $this->post('/login', ['empID' => $user->emp_id, 'password' => 'password'])
        ->assertSessionHasErrors(['empID' => 'Your one-time password has expired. Ask an administrator for a new one.']);

    $this->assertGuest();
});

test('a session left open past the expiry is signed out', function () {
    $user = User::factory()->onTemporaryPassword(now()->subMinute())->create();

    $this->actingAs($user)->get(route('dashboard'))->assertRedirect(route('login'));

    $this->assertGuest();
});
