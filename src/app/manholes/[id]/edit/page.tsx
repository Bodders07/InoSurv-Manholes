'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SidebarLayout from '@/app/components/SidebarLayout'
import { supabase } from '@/lib/supabaseClient'

type Manhole = {
  id: string
  project_id: string
  identifier: string | null
  service_type: string | null
  service_type_other: string | null
  location_type: string | null
  location_other: string | null
  lid_material: string | null
  chamber_construction: string | null
}

export default function EditManholePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const manholeId = params.id

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [identifier, setIdentifier] = useState('')
  const [serviceType, setServiceType] = useState('')
  const [serviceTypeOther, setServiceTypeOther] = useState('')
  const [locationType, setLocationType] = useState('')
  const [locationOther, setLocationOther] = useState('')
  const [lidMaterial, setLidMaterial] = useState('')
  const [chamberConstruction, setChamberConstruction] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('manholes')
        .select('id, identifier, service_type, service_type_other, location_type, location_other, lid_material, chamber_construction')
        .eq('id', manholeId)
        .maybeSingle()
      if (error) setMessage('Error loading manhole: ' + error.message)
      if (data) {
        setIdentifier(data.identifier || '')
        setServiceType(data.service_type || '')
        setServiceTypeOther(data.service_type_other || '')
        setLocationType(data.location_type || '')
        setLocationOther(data.location_other || '')
        setLidMaterial(data.lid_material || '')
        setChamberConstruction(data.chamber_construction || '')
      }
      setLoading(false)
    }
    load()
  }, [manholeId])

  async function save() {
    setMessage('')
    const update: Partial<Manhole> = {
      identifier,
      service_type: serviceType || null,
      service_type_other: serviceType === 'Other' ? (serviceTypeOther || null) : null,
      location_type: locationType || null,
      location_other: locationType === 'Other' ? (locationOther || null) : null,
      lid_material: lidMaterial || null,
      chamber_construction: chamberConstruction || null,
    }
    const { error } = await supabase.from('manholes').update(update).eq('id', manholeId)
    if (error) setMessage('Error: ' + error.message)
    else setMessage('Success: Manhole updated.')
  }

  return (
    <SidebarLayout>
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Edit Manhole</h1>
        {message && <p className={`mb-4 ${message.startsWith('Error') ? 'text-red-600' : 'text-green-700'}`}>{message}</p>}
        {loading ? (
          <p>Loading…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Identifier</label>
              <input className="w-full border p-2 rounded" value={identifier} onChange={(e)=>setIdentifier(e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Service Type</label>
              <select className="w-full border p-2 rounded" value={serviceType} onChange={(e)=>setServiceType(e.target.value)}>
                <option value="">Select service type</option>
                {['Water','Foul Water','Surface Water','Combined','Soakaway','Interceptor','Storm Water overflow','Electric','BT','Telecom','Traffic Signal','CATV','SV','FH','AV','Water Outlet','CCTV','Comms','Fuel Vent','Fuel Filler','WM','Empty','Gas Valve','Other'].map(o=> <option key={o} value={o}>{o}</option>)}
              </select>
              {serviceType === 'Other' && (
                <input className="mt-2 w-full border p-2 rounded" placeholder="If Other, specify" value={serviceTypeOther} onChange={(e)=>setServiceTypeOther(e.target.value)} />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <select className="w-full border p-2 rounded" value={locationType} onChange={(e)=>setLocationType(e.target.value)}>
                <option value="">Select location</option>
                {['Dn Cess','Up Cess','6ft','10ft','Left Cess','Right Cess','Off Track','Up & Dn Cess','Other'].map(o=> <option key={o} value={o}>{o}</option>)}
              </select>
              {locationType === 'Other' && (
                <input className="mt-2 w-full border p-2 rounded" placeholder="If Other, specify" value={locationOther} onChange={(e)=>setLocationOther(e.target.value)} />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Lid Material</label>
              <select className="w-full border p-2 rounded" value={lidMaterial} onChange={(e)=>setLidMaterial(e.target.value)}>
                <option value="">Select lid material</option>
                {['Lid Missing','Concrete Single Lid','Concrete Multiple Lids','Concrete Lids with Metal Grille','Plastic Grille','Timber','Metal Grille','Steel','Cast Iron','Metal'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Chamber Construction</label>
              <select className="w-full border p-2 rounded" value={chamberConstruction} onChange={(e)=>setChamberConstruction(e.target.value)}>
                <option value="">Select chamber construction</option>
                {['Unknown / Unable to lift','Brick','Concrete Rings','Plastic','Excavated'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button onClick={save} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Save</button>
          <button onClick={()=> router.back()} className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50">Back</button>
        </div>
      </div>
    </SidebarLayout>
  )
}

