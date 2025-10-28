import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { StyleSheet, View, Alert } from 'react-native'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Text } from './ui/text'
import { Session } from '@supabase/supabase-js'
import Avatar from './Avatar'

export default function Account({ session }: { session: Session }) {
    const [loading, setLoading] = useState(true)
    const [username, setUsername] = useState('')
    const [website, setWebsite] = useState('')
    const [avatarUrl, setAvatarUrl] = useState('')

    useEffect(() => {
        if (session) getProfile()
    }, [session])

    async function getProfile() {
        try {
            setLoading(true)
            if (!session?.user) throw new Error('No user on the session!')

            const { data, error, status } = await supabase
                .from('profiles')
                .select(`username, website, avatar_url`)
                .eq('id', session?.user.id)
                .single()
            if (error && status !== 406) {
                throw error
            }

            if (data) {
                setUsername(data.username)
                setWebsite(data.website)
                setAvatarUrl(data.avatar_url)
            }
        } catch (error) {
            if (error instanceof Error) {
                Alert.alert(error.message)
            }
        } finally {
            setLoading(false)
        }
    }

    async function updateProfile({
        username,
        website,
        avatar_url,
    }: {
        username: string
        website: string
        avatar_url: string
    }) {
        try {
            setLoading(true)
            if (!session?.user) throw new Error('No user on the session!')

            const updates = {
                id: session?.user.id,
                username,
                website,
                avatar_url,
                updated_at: new Date(),
            }

            const { error } = await supabase.from('profiles').upsert(updates)

            if (error) {
                throw error
            }
        } catch (error) {
            if (error instanceof Error) {
                Alert.alert(error.message)
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <View style={styles.container}>
            <View>
                <Avatar
                    size={200}
                    url={avatarUrl}
                    onUpload={(url: string) => {
                        setAvatarUrl(url)
                        updateProfile({ username, website, avatar_url: url })
                    }}
                />
            </View>
            <View style={[styles.verticallySpaced, styles.mt20]}>
                <Text variant="small" className="mb-2">Email</Text>
                <Input value={session?.user?.email} editable={false} />
            </View>
            <View style={styles.verticallySpaced}>
                <Text variant="small" className="mb-2">Username</Text>
                <Input value={username || ''} onChangeText={(text: string) => setUsername(text)} />
            </View>
            <View style={styles.verticallySpaced}>
                <Text variant="small" className="mb-2">Website</Text>
                <Input value={website || ''} onChangeText={(text: string) => setWebsite(text)} />
            </View>

            <View style={[styles.verticallySpaced, styles.mt20]}>
                <Button
                    onPress={() => updateProfile({ username, website, avatar_url: avatarUrl })}
                    disabled={loading}
                >
                    <Text>{loading ? 'Loading...' : 'Update'}</Text>
                </Button>
            </View>

            <View style={styles.verticallySpaced}>
                <Button variant="destructive" onPress={() => supabase.auth.signOut()}>
                    <Text>Sign Out</Text>
                </Button>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        marginTop: 40,
        padding: 12,
    },
    verticallySpaced: {
        paddingTop: 4,
        paddingBottom: 4,
        alignSelf: 'stretch',
    },
    mt20: {
        marginTop: 20,
    },
})