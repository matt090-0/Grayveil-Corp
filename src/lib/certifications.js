export async function grantCertification(supabase, { memberId, certId, certifiedBy }) {
  // Pre-check first so "already certified" is handled as a clean no-op
  // and never surfaces as a red DB error toast.
  const { data: existing, error: existingError } = await supabase
    .from('member_certifications')
    .select('id')
    .eq('member_id', memberId)
    .eq('cert_id', certId)
    .maybeSingle()

  if (!existingError && existing?.id) return { error: null, already: true }
  if (existingError && existingError.code !== 'PGRST116') {
    return { error: existingError, already: false }
  }

  // Some deployments only allow INSERT without privileged columns,
  // while others require certified_by = auth.uid(). Try both paths.
  const primary = await supabase.from('member_certifications').insert({
    member_id: memberId,
    cert_id: certId,
    certified_by: certifiedBy,
  })
  if (!primary.error) return { error: null, already: false }

  if (primary.error.code === '23505') return { error: null, already: true }

  if (primary.error.code === '42501') {
    const fallback = await supabase.from('member_certifications').insert({
      member_id: memberId,
      cert_id: certId,
    })
    if (!fallback.error) return { error: null, already: false }
    if (fallback.error.code === '23505') return { error: null, already: true }
    return { error: fallback.error, already: false }
  }

  return { error: primary.error, already: false }
}
