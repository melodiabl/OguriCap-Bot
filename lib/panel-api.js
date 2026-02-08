// ... (Mantener importaciones y configuración base hasta las rutas de notificaciones)

      // Implementación Real de la API de Notificaciones con PostgreSQL
      if (pathname === '/api/notificaciones' && method === 'GET') {
        const auth = await getJwtAuth(req)
        if (!auth.ok) return json(res, auth.status, { error: auth.error })

        const page = parseInt(url.searchParams.get('page') || '1')
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const offset = (page - 1) * limit
        const category = url.searchParams.get('category')
        const type = url.searchParams.get('type')
        const read = url.searchParams.get('read')

        try {
          if (!global.db?.pool) return json(res, 503, { error: 'Database not available' })

          let query = 'SELECT * FROM notifications WHERE 1=1'
          const params = []
          let paramIdx = 1

          if (category && category !== 'all') {
            query += ` AND categoria = $${paramIdx++}`
            params.push(category)
          }
          if (type && type !== 'all') {
            query += ` AND tipo = $${paramIdx++}`
            params.push(type)
          }
          if (read !== null && read !== undefined && read !== 'all') {
            query += ` AND leida = $${paramIdx++}`
            params.push(read === 'true' || read === 'read')
          }

          if (auth.user.rol !== 'owner' && auth.user.rol !== 'admin') {
            query += ` AND (user_id = $${paramIdx++} OR user_id IS NULL)`
            params.push(auth.user.id)
          }

          const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)')
          const totalResult = await global.db.pool.query(countQuery, params)
          const totalItems = parseInt(totalResult.rows[0].count)

          query += ` ORDER BY fecha_creacion DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`
          params.push(limit, offset)

          const result = await global.db.pool.query(query, params)
          
          return json(res, 200, {
            notifications: result.rows,
            pagination: {
              total: totalItems,
              page,
              limit,
              totalPages: Math.ceil(totalItems / limit)
            }
          })
        } catch (error) {
          console.error('Error fetching notifications:', error)
          return json(res, 500, { error: 'Error interno del servidor' })
        }
      }

      if (pathname === '/api/notificaciones' && method === 'POST') {
        const auth = await getJwtAuth(req)
        if (!auth.ok) return json(res, auth.status, { error: auth.error })
        if (auth.user.rol !== 'owner' && auth.user.rol !== 'admin') {
          return json(res, 403, { error: 'No tienes permisos para crear notificaciones' })
        }

        const body = await readJson(req).catch(() => ({}))
        try {
          const notification = await notificationSystem.send({
            title: body.titulo || body.title,
            message: body.mensaje || body.message,
            type: body.tipo || body.type || 'info',
            category: body.categoria || body.category || 'general',
            user_id: body.user_id || null,
            data: body.data || {}
          })
          return json(res, 201, notification)
        } catch (error) {
          return json(res, 400, { error: error.message })
        }
      }

      if (pathname === '/api/notificaciones/mark-all-read' && method === 'POST') {
        const auth = await getJwtAuth(req)
        if (!auth.ok) return json(res, auth.status, { error: auth.error })

        try {
          if (!global.db?.pool) return json(res, 503, { error: 'Database not available' })

          let query = 'UPDATE notifications SET leida = true WHERE leida = false'
          const params = []
          
          if (auth.user.rol !== 'owner' && auth.user.rol !== 'admin') {
            query += ' AND (user_id = $1 OR user_id IS NULL)'
            params.push(auth.user.id)
          }

          await global.db.pool.query(query, params)
          sseBroadcast('notificaciones', { type: 'notificationChanged' })
          return json(res, 200, { success: true })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      const notifReadMatch = pathname.match(/^\/api\/notificaciones\/(\d+)\/read$/)
      if (notifReadMatch && (method === 'PATCH' || method === 'POST')) {
        const auth = await getJwtAuth(req)
        if (!auth.ok) return json(res, auth.status, { error: auth.error })
        
        const id = parseInt(notifReadMatch[1])
        try {
          if (!global.db?.pool) return json(res, 503, { error: 'Database not available' })

          await global.db.pool.query(
            'UPDATE notifications SET leida = true WHERE id = $1',
            [id]
          )
          sseBroadcast('notificaciones', { type: 'notificationChanged' })
          return json(res, 200, { success: true })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      const notifIdMatch = pathname.match(/^\/api\/notificaciones\/(\d+)$/)
      if (notifIdMatch && method === 'DELETE') {
        const auth = await getJwtAuth(req)
        if (!auth.ok) return json(res, auth.status, { error: auth.error })

        const id = parseInt(notifIdMatch[1])
        try {
          if (!global.db?.pool) return json(res, 503, { error: 'Database not available' })

          await global.db.pool.query('DELETE FROM notifications WHERE id = $1', [id])
          sseBroadcast('notificaciones', { type: 'notificationChanged' })
          return json(res, 200, { success: true })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }
