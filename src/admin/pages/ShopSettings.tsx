import SettingsForm from '../SettingsForm'
import { PageHeader } from '../ui'

export default function ShopSettings() {
  return (
    <>
      <PageHeader title="Nos informations" subtitle="Coordonnées affichées dans le pied de page, la page Contact et les boutons WhatsApp." />
      <SettingsForm
        settingKey="shop"
        title="Boutique"
        fields={[
          { key: 'name', label: 'Nom de la boutique *' },
          { key: 'currency', label: 'Devise affichée', hint: 'Ex. Ar, €, $' },
          { key: 'tagline', label: 'Slogan', wide: true },
          { key: 'phone', label: 'Téléphone', type: 'tel' },
          { key: 'email', label: 'E-mail', type: 'email' },
          { key: 'whatsapp', label: 'Numéro WhatsApp', hint: 'Format international sans + ni espaces, ex. 261340000000. Vide = bouton masqué.' },
          { key: 'hours', label: "Horaires d'ouverture" },
          { key: 'address', label: 'Adresse', wide: true },
          { key: 'instagram', label: 'Lien Instagram', type: 'url' },
          { key: 'facebook', label: 'Lien Facebook', type: 'url' },
        ]}
      />
    </>
  )
}
