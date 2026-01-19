import prisma from '../prisma-client';

export class InteractionService {
  /**
   * Match contacts by email addresses
   */
  static async matchContactsByEmail(emails: string[]): Promise<number[]> {
    if (!emails || emails.length === 0) {
      return [];
    }

    // Normalize emails (lowercase, trim)
    const normalizedEmails = emails
      .map(email => email?.toLowerCase().trim())
      .filter(email => email && email.includes('@'));

    if (normalizedEmails.length === 0) {
      return [];
    }

    // Find contacts matching any of the emails
    const contacts = await prisma.contacts.findMany({
      where: {
        email: {
          in: normalizedEmails,
        },
      },
      select: {
        contact_id: true,
      },
    });

    return contacts.map(c => c.contact_id);
  }

  /**
   * Link calendar event to contacts
   */
  static async linkCalendarEvent(
    userId: number,
    eventData: {
      id: string;
      subject: string;
      start: string | { dateTime: string; timeZone?: string };
      end: string | { dateTime: string; timeZone?: string };
      location?: { displayName?: string };
      attendees?: Array<{ emailAddress?: { address?: string; name?: string } }>;
    }
  ): Promise<void> {
    try {
      // Extract attendee emails
      const attendeeEmails: string[] = [];
      const attendeeNames: string[] = [];

      if (eventData.attendees && Array.isArray(eventData.attendees)) {
        eventData.attendees.forEach(attendee => {
          if (attendee.emailAddress?.address) {
            attendeeEmails.push(attendee.emailAddress.address);
            if (attendee.emailAddress.name) {
              attendeeNames.push(attendee.emailAddress.name);
            }
          }
        });
      }

      // Match contacts by email
      const contactIds = await this.matchContactsByEmail(attendeeEmails);

      if (contactIds.length === 0) {
        // No contacts matched, skip interaction creation
        return;
      }

      // Prepare interaction data
      const startDateTime = typeof eventData.start === 'string' 
        ? eventData.start 
        : eventData.start.dateTime;
      const endDateTime = typeof eventData.end === 'string' 
        ? eventData.end 
        : eventData.end.dateTime;
      const locationName = eventData.location?.displayName || null;

      const interactionData = {
        event_id: eventData.id,
        subject: eventData.subject,
        date: startDateTime,
        start: startDateTime,
        end: endDateTime,
        location: locationName,
        participants: attendeeEmails.map((email, idx) => ({
          email,
          name: attendeeNames[idx] || null,
        })),
      };

      // Create interactions for each matched contact
      const interactionPromises = contactIds.map(contactId =>
        prisma.contact_interactions.create({
          data: {
            contact_id: contactId,
            interaction_type: 'calendar_event',
            interaction_data: JSON.stringify(interactionData),
            related_entity_type: null,
            related_entity_id: null,
            created_by: userId,
          },
        }).catch(error => {
          // Log error but don't fail the entire operation
          console.error(`Failed to create interaction for contact ${contactId}:`, error);
          return null;
        })
      );

      await Promise.all(interactionPromises);
      console.log(`[InteractionService] Linked calendar event ${eventData.id} to ${contactIds.length} contact(s)`);
    } catch (error) {
      // Log error but don't throw - auto-linking should not break main operations
      console.error('[InteractionService] Error linking calendar event:', error);
    }
  }

  /**
   * Link task to contacts
   */
  static async linkTask(
    userId: number,
    taskData: {
      task_id: number;
      task_name: string;
      client_id: number;
      matter_id: number;
      due_date: Date;
      description?: string | null;
    }
  ): Promise<void> {
    try {
      // Find primary contact for the client (or all contacts if no primary)
      const contacts = await prisma.contacts.findMany({
        where: {
          client_id: taskData.client_id,
        },
        orderBy: [
          { is_primary: 'desc' }, // Primary contacts first
          { created_at: 'asc' },
        ],
        take: 1, // Only link to primary contact to avoid spam
        select: {
          contact_id: true,
        },
      });

      if (contacts.length === 0) {
        // No contacts for this client, skip
        return;
      }

      const contactId = contacts[0].contact_id;

      // Prepare interaction data
      const interactionData = {
        task_id: taskData.task_id,
        task_name: taskData.task_name,
        due_date: taskData.due_date.toISOString(),
        description: taskData.description || null,
      };

      // Create interaction
      await prisma.contact_interactions.create({
        data: {
          contact_id: contactId,
          interaction_type: 'task',
          interaction_data: JSON.stringify(interactionData),
          related_entity_type: 'task',
          related_entity_id: taskData.task_id,
          created_by: userId,
        },
      });

      console.log(`[InteractionService] Linked task ${taskData.task_id} to contact ${contactId}`);
    } catch (error) {
      // Log error but don't throw
      console.error('[InteractionService] Error linking task:', error);
    }
  }

  /**
   * Link matter to contacts
   */
  static async linkMatter(
    userId: number,
    matterData: {
      matter_id: number;
      matter_title: string;
      client_id: number;
      practice_area?: string | null;
      start_date: Date;
    }
  ): Promise<void> {
    try {
      // Find primary contact for the client
      const contacts = await prisma.contacts.findMany({
        where: {
          client_id: matterData.client_id,
        },
        orderBy: [
          { is_primary: 'desc' },
          { created_at: 'asc' },
        ],
        take: 1, // Only link to primary contact
        select: {
          contact_id: true,
        },
      });

      if (contacts.length === 0) {
        // No contacts for this client, skip
        return;
      }

      const contactId = contacts[0].contact_id;

      // Prepare interaction data
      const interactionData = {
        matter_id: matterData.matter_id,
        matter_title: matterData.matter_title,
        practice_area: matterData.practice_area || null,
        start_date: matterData.start_date.toISOString(),
      };

      // Create interaction
      await prisma.contact_interactions.create({
        data: {
          contact_id: contactId,
          interaction_type: 'matter',
          interaction_data: JSON.stringify(interactionData),
          related_entity_type: 'matter',
          related_entity_id: matterData.matter_id,
          created_by: userId,
        },
      });

      console.log(`[InteractionService] Linked matter ${matterData.matter_id} to contact ${contactId}`);
    } catch (error) {
      // Log error but don't throw
      console.error('[InteractionService] Error linking matter:', error);
    }
  }
}

