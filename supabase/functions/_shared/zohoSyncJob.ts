import { syncPaidReservationToZoho } from './zohoReservationSync.ts'

export async function processSingleZohoSync(supabase: any, reservationId: string) {
  try {
    const syncResult = await syncPaidReservationToZoho(supabase, reservationId)

    await supabase
      .from('reservations')
      .update({
        zoho_sync_status: 'synced',
        zoho_last_error: null,
        zoho_lead_id: syncResult.zohoLeadId,
        zoho_contact_id: syncResult.zohoContactId,
        zoho_reservation_id: syncResult.zohoReservationId,
      })
      .eq('id', reservationId)

    await supabase
      .from('zoho_sync_jobs')
      .update({
        status: 'succeeded',
        attempt_count: 1,
        last_error: null,
        locked_at: null,
      })
      .eq('reservation_id', reservationId)
      .in('status', ['pending', 'retry', 'processing'])
  } catch (err: any) {
    const message = String(err?.message ?? 'Zoho sync failed')
    await supabase
      .from('reservations')
      .update({
        zoho_sync_status: 'failed',
        zoho_last_error: message,
      })
      .eq('id', reservationId)

    await supabase
      .from('zoho_sync_jobs')
      .update({
        status: 'retry',
        attempt_count: 1,
        last_error: message,
        run_after: new Date(Date.now() + 60_000).toISOString(),
        locked_at: null,
      })
      .eq('reservation_id', reservationId)
      .in('status', ['pending', 'retry', 'processing'])
  }
}
