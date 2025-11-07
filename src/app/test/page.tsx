'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function TestPage() {
  const [message, setMessage] = useState('Checking Supabase...')

  useEffect(() => {
    async function check() {
      const { data, error } = await supabase.from('test_table').select('*').limit(1)
      if (error) setMessage('Error: Connection failed: ' + error.message)
      else setMessage('Success: Supabase connected! Table is accessible')
    }
    check()
  }, [])

  return <div className="p-8 text-lg">{message}</div>
}

