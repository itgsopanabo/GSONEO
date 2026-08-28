<?php

namespace App\Http\Controllers\Others;

use App\Http\Controllers\Controller;
use App\Http\Requests\others\leavePrintRequest;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class LeaveController extends Controller
{
    /**
     * Fields that print in uppercase on the official CS Form No. 6.
     */
    private const UPPERCASE = ['office', 'last', 'first', 'middle', 'position'];

    /**
     * Show the leave application form.
     */
    public function create(Request $request): InertiaResponse
    {
        $user = $request->user();

        return Inertia::render('General/leaveform', [
            'employee' => [
                'office' => $user->office ?? 'CGSO',
                'last_name' => $user->last_name ?? '',
                'first_name' => $user->first_name ?? '',
                'middle_name' => $user->middle_name ?? '',
                'position' => $user->position ?? '',
            ],
        ]);
    }

    /**
     * Render the printable leave form from the query string.
     */
    public function print(leavePrintRequest $request): View
    {
        // validated() only returns keys that were actually sent, so start from
        // a blank slate and overlay what came in.
        $data = array_merge(
            array_fill_keys($request->fieldNames(), ''),
            $request->validated(),
        );

        foreach (self::UPPERCASE as $key) {
            if ($data[$key] !== '') {
                $data[$key] = mb_strtoupper($data[$key]);
            }
        }

        if ($data['date_filing'] !== '') {
            $data['date_filing'] = mb_strtoupper(
                Carbon::parse($data['date_filing'])->format('F j, Y'),
            );
        }

        $data['ticks'] = $data['ticks'] ?: [];

        return view('pdf.leave', $data);
    }
}
