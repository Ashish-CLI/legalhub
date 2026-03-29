export default function ActivityFeed() {
  const activities = [
    {
      id: 1,
      user: 'John Smith',
      action: 'submitted a new case',
      case: 'Smith vs. Corp Inc.',
      time: '2 hours ago',
      type: 'case'
    },
    {
      id: 2,
      user: 'Sarah Johnson',
      action: 'uploaded documents',
      case: 'Johnson Property Dispute',
      time: '4 hours ago',
      type: 'document'
    },
    {
      id: 3,
      user: 'Mike Davis',
      action: 'scheduled hearing',
      case: 'Davis vs. LLC',
      time: '1 day ago',
      type: 'hearing'
    },
    {
      id: 4,
      user: 'Admin Team',
      action: 'approved account',
      case: 'New Lawyer Registration',
      time: '2 days ago',
      type: 'admin'
    }
  ]

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'case': return '📁'
      case 'document': return '📄'
      case 'hearing': return '📅'
      case 'admin': return '✅'
      default: return 'ℹ️'
    }
  }

  return (
    <div className="flow-root">
      <ul className="divide-y divide-gray-200">
        {activities.map((activity) => (
          <li key={activity.id} className="py-4">
            <div className="flex space-x-3">
              <div className="flex-shrink-0">
                <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-800">
                  {getTypeIcon(activity.type)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-800">
                  <span className="font-medium">{activity.user}</span> {activity.action}
                </p>
                <p className="text-sm text-gray-600">
                  {activity.case}
                </p>
                <p className="text-xs text-gray-500">
                  {activity.time}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}