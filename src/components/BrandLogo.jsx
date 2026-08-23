import logoSrc from '../assets/gatesandbarrierslogo.png'

const LOGO_SRC = logoSrc
const LOGO_ALT = 'Gates and Barriers Logo'

const BrandLogo = ({
  className = '',
  imgClassName = '',
  variant = 'default',
}) => {
  return (
    <div className={`flex min-w-0 items-center justify-center overflow-hidden ${className}`}>
      <img
        src={LOGO_SRC}
        alt={LOGO_ALT}
        className={`h-full w-full object-contain mix-blend-multiply ${imgClassName}`}
        loading="eager"
      />
    </div>
  )
}

export { LOGO_SRC, LOGO_ALT }
export default BrandLogo

