import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { pool } from '@/lib/db'

const notificationEmail = 'singhridam20@gmail.com'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.fullName || !body.phone || !body.lookingFor || !body.contactMethods?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const requestId = `DS-REQ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
    const budget = body.budget ? Number(String(body.budget).replace(/\D/g, '')) : null
    await pool.query(
      'INSERT INTO customer_requests (request_id, full_name, phone, email, looking_for, brand_preference, model_name, capacity, condition, budget, requirements, contact_methods, product_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
      [requestId, body.fullName, body.phone, body.email || null, body.lookingFor, body.brand || null, body.model || null, body.capacity || null, body.condition || null, budget, body.requirements || null, body.contactMethods.join(', '), body.productName || null],
    )

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const details = [
        ['Request ID', requestId],
        ['Name', body.fullName],
        ['Phone', body.phone],
        ['Email', body.email || 'Not provided'],
        ['Looking for', body.lookingFor],
        ['Brand', body.brand || 'No preference'],
        ['Model', body.model || 'Not specified'],
        ['Capacity', body.capacity || 'Not specified'],
        ['Condition', body.condition || 'Any condition'],
        ['Budget', budget ? `₹${budget.toLocaleString('en-IN')}` : 'Not specified'],
        ['Contact via', body.contactMethods.join(', ')],
        ['Requirements', body.requirements || 'None'],
      ]

      const { error } = await resend.emails.send({
        from: 'DS Cooling <onboarding@resend.dev>',
        to: [notificationEmail],
        subject: `New appliance request ${requestId}`,
        text: `A new request was submitted on DS Cooling.\n\n${details.map(([label, value]) => `${label}: ${value}`).join('\n')}`,
      })

      if (error) console.error('[v0] Request notification failed:', error)
    }

    return NextResponse.json({ requestId })
  } catch (error) {
    console.error('[v0] Request submission failed:', error)
    return NextResponse.json({ error: 'Unable to submit request' }, { status: 500 })
  }
}
