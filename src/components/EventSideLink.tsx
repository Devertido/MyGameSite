import type { EventSide, Organization } from '../domain/timeline'

export function EventSideLink({ side, organizations }: {
  side: EventSide
  organizations?: Organization[]
}) {
  const organization = organizations?.find(({ id }) => id === side.organizationId)
  return organization
    ? <a href={`#organizations?organization=${encodeURIComponent(organization.id)}`}>{organization.name}</a>
    : side.name
}
