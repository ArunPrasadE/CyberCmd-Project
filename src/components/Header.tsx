import tfMark from '../assets/tf-mark.svg'

export function Header({ verified, total }: { verified: number; total: number }) {
  return (
    <header className="site-header">
      <div className="brand">
        <h1 className="wordmark">
          Cyber<span>Cmd</span>
        </h1>
        <span className="byline">
          <img src={tfMark} alt="" width={30} height={28} />
          by TharunForge
        </span>
      </div>
      <p className="progress" title="Flags I have run in my own lab and recorded a note for">
        <strong>
          {verified}/{total}
        </strong>{' '}
        verified in lab
      </p>
    </header>
  )
}
