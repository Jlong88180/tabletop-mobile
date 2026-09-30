import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { supabase } from './supabase';

const fallbackGames = ['Pokémon','Magic: The Gathering','Disney Lorcana','Yu-Gi-Oh!','One Piece Card Game','Flesh and Blood','Catan','Wingspan','Warhammer','Azul'];

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) return <Splash />;
  if (!session) return <AuthScreen />;
  return <MainApp user={session.user} />;
}

function Splash() {
  return <SafeAreaView style={s.root}><View style={s.center}><Text style={s.kicker}>THE GUILD HALL</Text><Text style={s.logo}>Tabletop</Text><ActivityIndicator color="#d7b66b" style={{marginTop:20}} /></View></SafeAreaView>;
}

function AuthScreen() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || password.length < 6 || (mode === 'signup' && !displayName.trim())) {
      Alert.alert('Almost there', mode === 'signup' ? 'Enter your name, email and a password of at least 6 characters.' : 'Enter your email and password.');
      return;
    }
    setBusy(true);
    const result = mode === 'signup'
      ? await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: displayName.trim() } } })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (result.error) return Alert.alert('Could not sign in', result.error.message);
    if (mode === 'signup' && !result.data.session) Alert.alert('Check your email', 'Supabase may require email confirmation before your first sign-in.');
  };

  return <SafeAreaView style={s.root}><ScrollView contentContainerStyle={s.authContent}>
    <Text style={s.kicker}>THE GUILD HALL</Text><Text style={s.logo}>Tabletop</Text>
    <Text style={s.title}>{mode === 'signup' ? 'Join the guild.' : 'Welcome back.'}</Text>
    <Text style={s.sub}>{mode === 'signup' ? 'Create your player account and find your people.' : 'Sign in to your tabletop community.'}</Text>
    {mode === 'signup' && <TextInput value={displayName} onChangeText={setDisplayName} placeholder="Display name" placeholderTextColor="#777389" style={s.input} />}
    <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#777389" autoCapitalize="none" keyboardType="email-address" style={s.input} />
    <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="#777389" secureTextEntry style={s.input} />
    <Pressable style={s.goldBtn} onPress={submit} disabled={busy}><Text style={s.goldText}>{busy ? 'Opening the gates…' : mode === 'signup' ? 'Create my account' : 'Enter Tabletop'}</Text></Pressable>
    <Pressable style={s.switchBtn} onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}><Text style={s.switchText}>{mode === 'signup' ? 'Already a player? Sign in' : 'New to Tabletop? Create an account'}</Text></Pressable>
  </ScrollView></SafeAreaView>;
}

function MainApp({ user }) {
  const [tab, setTab] = useState('Home');
  const [profile, setProfile] = useState(null);
  const [games, setGames] = useState([]);
  const [mine, setMine] = useState([]);
  const [posts, setPosts] = useState([]);
  const [players, setPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  const [connections, setConnections] = useState([]);
  const [looking, setLooking] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(true);

  const load = async () => {
    setBusy(true);
    const [{ data: p }, { data: g }, { data: ug }, { data: po }, { data: pr }, { data: ev }, { data: co }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('games').select('*').order('name'),
      supabase.from('user_games').select('game_id').eq('user_id', user.id),
      supabase.from('posts').select('id,author_id,game_id,content,created_at,profiles(display_name,username),games(name)').order('created_at', { ascending: false }).limit(30),
      supabase.from('profiles').select('id,display_name,username').neq('id', user.id).limit(20),
      supabase.from('events').select('id,title,description,venue,city,starts_at,capacity,game_id,games(name),profiles(display_name)').gte('starts_at', new Date().toISOString()).order('starts_at').limit(20),
      supabase.from('connections').select('id,requester_id,addressee_id,status').or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    ]);
    if (p) setProfile(p);
    if (g) setGames(g);
    if (ug) setMine(ug.map(x => x.game_id));
    if (po) setPosts(po);
    if (pr) setPlayers(pr);
    if (ev) setEvents(ev);
    if (co) setConnections(co);
    setBusy(false);
  };

  useEffect(() => { load(); }, [user.id]);

  const mineNames = useMemo(() => games.filter(g => mine.includes(g.id)).map(g => g.name), [games, mine]);
  const toggleGame = async (gameId) => {
    const selected = mine.includes(gameId);
    if (selected) {
      await supabase.from('user_games').delete().eq('user_id', user.id).eq('game_id', gameId);
      setMine(mine.filter(id => id !== gameId));
    } else {
      const { error } = await supabase.from('user_games').insert({ user_id: user.id, game_id: gameId });
      if (!error) setMine([...mine, gameId]);
    }
  };

  const addPost = async () => {
    if (!draft.trim()) return;
    const gameId = mine[0] || null;
    const { data, error } = await supabase.from('posts').insert({ author_id: user.id, game_id: gameId, content: draft.trim() }).select('id,author_id,game_id,content,created_at,profiles(display_name,username),games(name)').single();
    if (error) return Alert.alert('Could not post', error.message);
    setPosts([data, ...posts]); setDraft('');
  };

  const connect = async (playerId) => {
    const existing = connections.find(c => (c.requester_id === playerId && c.addressee_id === user.id) || (c.requester_id === user.id && c.addressee_id === playerId));
    if (existing) return;
    const { data, error } = await supabase.from('connections').insert({ requester_id: user.id, addressee_id: playerId }).select().single();
    if (error) return Alert.alert('Could not connect', error.message);
    setConnections([...connections, data]);
  };

  const toggleLooking = async () => {
    if (looking) {
      await supabase.from('play_requests').update({ status: 'closed' }).eq('user_id', user.id).eq('status', 'open');
      setLooking(false); return;
    }
    const gameId = mine[0];
    if (!gameId) return Alert.alert('Choose a game first', 'Pick at least one game in Games, then turn on Looking to Play.');
    const { error } = await supabase.from('play_requests').insert({ user_id: user.id, game_id: gameId, title: `Looking to play ${games.find(g => g.id === gameId)?.name || 'a game'}`, city: profile?.location_city || null });
    if (error) return Alert.alert('Could not create request', error.message);
    setLooking(true);
  };

  const formatDate = value => new Date(value).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  if (busy && !profile) return <Splash />;
  return <SafeAreaView style={s.root}><ScrollView contentContainerStyle={s.content}>
    <View style={s.header}><View><Text style={s.kicker}>THE GUILD HALL</Text><Text style={s.logo}>Tabletop</Text></View><Text style={s.emblem}>✦</Text></View>
    {tab === 'Home' && <>
      <Text style={s.title}>Find your people.</Text><Text style={s.sub}>Play the games you love.</Text>
      <Pressable style={s.hero} onPress={toggleLooking}><Text style={s.heroIcon}>⚔</Text><View style={{flex:1}}><Text style={s.heroTitle}>{looking ? 'You are looking to play' : 'Looking for a game?'}</Text><Text style={s.heroText}>{looking ? 'Your active play request is live.' : 'Tell nearby players what you want to play.'}</Text></View><Text style={s.arrow}>›</Text></Pressable>
      <Section title="Campfire discussions"/><TextInput value={draft} onChangeText={setDraft} placeholder="Start a discussion…" placeholderTextColor="#8d8ba3" style={s.input}/><Pressable style={s.goldBtn} onPress={addPost}><Text style={s.goldText}>Post to the campfire</Text></Pressable>
      {posts.map(p => <Card key={p.id}><View style={s.row}><Text style={s.avatar}>{(p.profiles?.display_name || '?')[0]}</Text><View><Text style={s.bold}>{p.profiles?.display_name || 'Player'}</Text><Text style={s.muted}>{p.games?.name || 'Tabletop'} · {new Date(p.created_at).toLocaleDateString()}</Text></View></View><Text style={s.body}>{p.content}</Text></Card>)}
    </>}
    {tab === 'Games' && <><Text style={s.title}>Your games</Text><Text style={s.sub}>Choose what you play.</Text>{(games.length ? games : fallbackGames.map(name => ({id:name,name}))).map(g => <Pressable key={g.id} style={[s.game, s.mine(mine.includes(g.id))]} onPress={() => g.id && toggleGame(g.id)}><Text style={s.gameIcon}>◆</Text><Text style={s.gameName}>{g.name}</Text><Text style={s.check}>{mine.includes(g.id) ? '✓' : '+'}</Text></Pressable>)}</>}
    {tab === 'Players' && <><Text style={s.title}>Find players</Text><Text style={s.sub}>Connect with people in the Tabletop community.</Text>{players.map(p => { const connected = connections.some(c => c.requester_id === p.id || c.addressee_id === p.id); return <Card key={p.id}><View style={s.row}><Text style={s.avatar}>{(p.display_name || '?')[0]}</Text><View style={{flex:1}}><Text style={s.bold}>{p.display_name}</Text><Text style={s.muted}>@{p.username}</Text></View><Pressable style={s.smallBtn} onPress={() => connect(p.id)}><Text style={s.smallText}>{connected ? 'Connected' : 'Connect'}</Text></Pressable></View></Card>; })}</>}
    {tab === 'Events' && <><Text style={s.title}>Events</Text><Text style={s.sub}>Gather around the table.</Text>{events.length ? events.map(e => <Card key={e.id}><Text style={s.date}>{formatDate(e.starts_at)}</Text><Text style={s.event}>{e.title}</Text><Text style={s.muted}>{e.venue || e.city || 'Community event'} · {e.games?.name || 'Tabletop'}</Text><Pressable style={s.goldBtn} onPress={async () => { const { error } = await supabase.from('event_attendees').upsert({ event_id: e.id, user_id: user.id, status: 'interested' }); if (error) Alert.alert('Could not join', error.message); else Alert.alert('Joined', `You're interested in ${e.title}.`); }}><Text style={s.goldText}>I'm interested</Text></Pressable></Card>) : <Card><Text style={s.body}>No upcoming events yet. Events created in Tabletop will appear here.</Text></Card>}</>}
    {tab === 'Profile' && <><Text style={s.title}>Your character</Text><Text style={s.sub}>Build your tabletop identity.</Text><Card><Text style={s.avatarBig}>{(profile?.display_name || 'Y')[0]}</Text><Text style={s.profileName}>{profile?.display_name || 'Tabletop Player'}</Text><Text style={s.muted}>@{profile?.username || 'player'} · {mine.length} games · {connections.length} connections</Text>{profile?.bio ? <Text style={s.body}>{profile.bio}</Text> : null}</Card><Section title="Your games"/>{mineNames.length ? mineNames.map(g => <Text key={g} style={s.tag}>◆ {g}</Text>) : <Text style={s.muted}>Choose your games from the Games tab.</Text>}<Pressable style={s.switchBtn} onPress={() => supabase.auth.signOut()}><Text style={s.switchText}>Sign out</Text></Pressable></>}
  </ScrollView><View style={s.nav}>{['Home','Games','Players','Events','Profile'].map(x => <Pressable key={x} onPress={() => setTab(x)} style={s.navItem}><Text style={[s.navIcon, tab === x && s.active]}>{({Home:'⌂',Games:'◇',Players:'♟',Events:'✦',Profile:'◉'})[x]}</Text><Text style={[s.navText,tab===x&&s.active]}>{x}</Text></Pressable>)}</View></SafeAreaView>;
}
function Section({title}) { return <View style={s.section}><Text style={s.sectionTitle}>{title}</Text><Text style={s.orn}>✦</Text></View>; }
function Card({children}) { return <View style={s.card}>{children}</View>; }
const s = StyleSheet.create({root:{flex:1,backgroundColor:'#0d0d1b'},center:{flex:1,alignItems:'center',justifyContent:'center'},authContent:{padding:24,paddingTop:70,flexGrow:1,justifyContent:'center'},content:{padding:20,paddingBottom:110},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:28},kicker:{color:'#a899d5',fontSize:10,letterSpacing:2,fontWeight:'700'},logo:{color:'#f1dfad',fontSize:28,fontWeight:'800'},emblem:{color:'#d7b66b',fontSize:28},title:{color:'#f5f0e4',fontSize:30,fontWeight:'800',marginTop:15},sub:{color:'#9996ad',fontSize:15,marginTop:5,marginBottom:20},hero:{flexDirection:'row',alignItems:'center',backgroundColor:'#19172b',borderWidth:1,borderColor:'#6d5a9b',borderRadius:18,padding:16,marginBottom:25},heroIcon:{fontSize:28,color:'#d7b66b',marginRight:14},heroTitle:{color:'#f5f0e4',fontSize:17,fontWeight:'800'},heroText:{color:'#9996ad',marginTop:4},arrow:{color:'#d7b66b',fontSize:28},section:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:8,marginBottom:12},sectionTitle:{color:'#e9dcbf',fontSize:18,fontWeight:'800'},orn:{color:'#d7b66b'},input:{backgroundColor:'#171626',borderWidth:1,borderColor:'#343047',borderRadius:14,color:'#fff',padding:14,minHeight:50,marginBottom:10},goldBtn:{backgroundColor:'#d7b66b',padding:12,borderRadius:12,alignItems:'center',marginTop:10},goldText:{color:'#17121c',fontWeight:'800'},switchBtn:{padding:14,alignItems:'center'},switchText:{color:'#c7b9e8',fontWeight:'700'},card:{backgroundColor:'#151424',borderWidth:1,borderColor:'#2d2940',borderRadius:16,padding:15,marginBottom:10},row:{flexDirection:'row',alignItems:'center'},avatar:{width:40,height:40,borderRadius:20,backgroundColor:'#403567',color:'#f3e8c8',textAlign:'center',textAlignVertical:'center',fontWeight:'800',marginRight:12},avatarBig:{width:70,height:70,borderRadius:35,backgroundColor:'#403567',color:'#f3e8c8',textAlign:'center',textAlignVertical:'center',fontSize:28,fontWeight:'800',marginBottom:12},bold:{color:'#f3eee3',fontWeight:'800'},muted:{color:'#8f8ca3',fontSize:12},body:{color:'#d8d3df',fontSize:15,lineHeight:21,marginTop:12},smallBtn:{borderWidth:1,borderColor:'#7a66a9',paddingHorizontal:12,paddingVertical:8,borderRadius:10},smallText:{color:'#d8c8ef',fontWeight:'700',fontSize:12},game:{flexDirection:'row',alignItems:'center',backgroundColor:'#151424',padding:16,borderRadius:14,marginBottom:9,borderWidth:1,borderColor:'#2d2940'},mine:v=>v?{borderColor:'#d7b66b',backgroundColor:'#1c1930'}:{},gameIcon:{color:'#d7b66b',marginRight:12},gameName:{color:'#eee9de',fontSize:15,fontWeight:'700',flex:1},check:{color:'#d7b66b',fontSize:20},date:{color:'#d7b66b',fontSize:12,fontWeight:'800',textTransform:'uppercase'},event:{color:'#f1eee7',fontSize:20,fontWeight:'800',marginVertical:5},profileName:{color:'#f1eee7',fontSize:20,fontWeight:'800'},tag:{color:'#d8c8ef',padding:12,backgroundColor:'#171626',borderRadius:10,marginBottom:8},nav:{position:'absolute',bottom:0,left:0,right:0,height:78,backgroundColor:'#11101f',borderTopWidth:1,borderTopColor:'#2d2940',flexDirection:'row',justifyContent:'space-around'},navItem:{alignItems:'center',justifyContent:'center',width:'20%'},navIcon:{color:'#777389',fontSize:20},navText:{color:'#777389',fontSize:10,marginTop:4},active:{color:'#d7b66b'}});
